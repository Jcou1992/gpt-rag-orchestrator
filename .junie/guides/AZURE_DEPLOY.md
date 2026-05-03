# Connect Vue Client to GPT-RAG Orchestrator on Azure Container Apps

> **Scenario:** Orchestrator is already deployed to Azure Container Apps via the `Azure/GPT-RAG` infra repo (zero-trust enterprise topology). You now need to wire your Vue 3 + Spring Boot client (scaffolded with the Junie skill) to call it from the cloud.
>
> **Read first:** the orchestrator infra is **not** in this repo. `infra/main.bicep` is intentionally empty and `scripts/preProvision.ps1` blocks `azd provision` / `azd up`. All networking, identity, private endpoints, and dependent services (App Configuration, Key Vault, Cosmos, AI Search, Foundry, ACR) come from `https://github.com/Azure/GPT-RAG`. This orchestrator repo only ships the workload container and the deploy pipeline that pushes it.

---

## 1. The zero-trust topology you are deploying into

The `Azure/GPT-RAG` infra provisions (typical enterprise pattern):

| Resource | Zero-trust posture |
|---|---|
| VNET + private subnets | All workloads inside VNET, no public IPs on data services |
| Container Apps Environment | **Internal-only** (no public ingress on default deployment) — fronted by App Gateway + WAF or APIM if external access required |
| ACR | Private endpoint, public network access disabled |
| Cosmos DB, AI Search, App Configuration, Key Vault, Storage, Foundry | Private endpoints only, public network access disabled |
| User-Assigned Managed Identity (UAMI) | Single identity assigned to orchestrator Container App, granted RBAC on every dependency |
| Entra ID | Tenant + two app registrations (orchestrator API + caller SPA) |
| Application Insights | Customer-managed key, VNET-injected |

Authentication for the orchestrator itself:
- `validate_access_token()` in `src/dependencies.py` — Entra JWT, JWKS cached per `(tenant_id, jwks_url)`, audience checked against `[OAUTH_AZURE_AD_CLIENT_ID, api://OAUTH_AZURE_AD_CLIENT_ID]`
- `ALLOW_ANONYMOUS=false` in App Configuration for prod
- Token is **kept in memory only** on `Orchestrator.request_access_token` — never persisted to Cosmos
- `IdentityManager` (`src/connectors/identity_manager.py`) uses `ManagedIdentityCredential(client_id=$AZURE_CLIENT_ID)` — the UAMI authenticates orchestrator → all backend Azure services
- User OBO token flows downstream to AI Search for permission-trimmed retrieval

**Implication for your Vue client:** you do **not** call the orchestrator directly from the browser, and depending on the infra config the orchestrator may not even be reachable from the public internet. Your Spring proxy lands inside the same VNET (or peered VNET) and is the only thing that talks to the orchestrator.

---

## 2. Topology you need to build

```
Public internet
   │
   ▼
Azure Front Door / App Gateway + WAF   (TLS, OWASP, geo, rate-limit)
   │  https://app.contoso.com
   ▼
Azure Static Web App (or Storage+CDN)  ← Vue 3 dist/
   │  fetch SSE + Bearer <user JWT>
   ▼
Azure Front Door / App Gateway         (path /api/* → Spring)
   │
   ▼
Container Apps Environment (VNET-internal)
   ├── spring-rag-proxy   ← validates JWT, OBO exchange, SSE→JSON normalize
   │      │ Bearer <OBO-token>
   │      ▼
   └── gpt-rag-orchestrator   ← internal ingress only, never public
          │
          ▼
       VNET-private: Foundry · AI Search · Cosmos · App Config · Key Vault
```

Hard rules:
1. **Vue NEVER calls orchestrator.** Vue → Spring proxy → orchestrator. Same as the local-dev `INTEGRATION_PLAN.md` shape, just with cloud URLs.
2. **Spring proxy lives in the same Container Apps Environment** as the orchestrator (or a peered VNET). Internal ingress is enough; orchestrator stays unreachable from the public internet.
3. **Front Door / App Gateway is the only public surface.** All TLS terminates here, WAF inspects, and only then forwards into the VNET.
4. **No tokens cross the wrong layer.** Browser holds user JWT (sessionStorage, never localStorage — invariant `scripts/check-auth-policy.mjs`). Spring exchanges via OBO and sends a different token to orchestrator. Orchestrator's UAMI handles all Azure-resource calls.

---

## 3. Step-by-step wiring

### 3.1 Confirm orchestrator deployment state

```bash
# Verify the Container App exists and is internal
az containerapp show \
  --name gpt-rag-orchestrator \
  --resource-group <rg> \
  --query "{fqdn: properties.configuration.ingress.fqdn, external: properties.configuration.ingress.external, vnet: properties.configuration.ingress.transport}"
```

Expect (zero-trust default):

```json
{
  "fqdn": "gpt-rag-orchestrator.internal.<env-id>.<region>.azurecontainerapps.io",
  "external": false,
  "vnet": "auto"
}
```

If `external: true`, the infra was deployed in non-zero-trust mode. Either keep it (smaller surface to manage but trades isolation) or re-deploy with internal ingress.

### 3.2 Verify orchestrator config in App Configuration

```bash
APP_CFG=$(azd env get-values | grep APP_CONFIG_ENDPOINT | cut -d= -f2 | tr -d '"')
APP_CFG_NAME=$(echo $APP_CFG | sed -E 's|https://([^.]+)\..*|\1|')

az appconfig kv list --name $APP_CFG_NAME --label gpt-rag \
  --query "[?starts_with(key,'OAUTH_') || starts_with(key,'ALLOW_') || starts_with(key,'AGENT_STRATEGY')].{key:key,value:value}" \
  -o table
```

You need at minimum:

```
OAUTH_AZURE_AD_TENANT_ID   <tenant-id>
OAUTH_AZURE_AD_CLIENT_ID   <orchestrator-api-app-client-id>
ALLOW_ANONYMOUS            false
AGENT_STRATEGY             maf_lite          # or another
```

Note `OAUTH_AZURE_AD_CLIENT_ID` is the **orchestrator's own API app registration** — the audience your inbound token must match. NOT the SPA, NOT the Spring proxy.

### 3.3 Provision Spring proxy in the same Container Apps Environment

Build and push your Spring image (the Junie-scaffolded backend):

```bash
cd backend
./gradlew bootBuildImage --imageName=spring-rag-proxy:latest

# Push to the same private ACR the orchestrator uses
ACR_NAME=$(az appconfig kv show --name $APP_CFG_NAME --label gpt-rag \
            --key CONTAINER_REGISTRY_NAME --query value -o tsv)
ACR_LOGIN=$(az appconfig kv show --name $APP_CFG_NAME --label gpt-rag \
            --key CONTAINER_REGISTRY_LOGIN_SERVER --query value -o tsv)

az acr login --name $ACR_NAME
docker tag spring-rag-proxy:latest $ACR_LOGIN/spring-rag-proxy:latest
docker push $ACR_LOGIN/spring-rag-proxy:latest
```

> If your dev box can't reach the private ACR (zero-trust, public access disabled), use `az acr build` from a self-hosted runner inside the VNET, or run the build job from a Container Apps job. The orchestrator's `scripts/deploy.ps1` falls back to `az acr build` on the same condition — copy that pattern.

Provision the proxy:

```bash
ENV_NAME=$(az containerapp show --name gpt-rag-orchestrator --resource-group <rg> \
            --query properties.managedEnvironmentId -o tsv | awk -F/ '{print $NF}')

# Create user-assigned managed identity for the proxy
az identity create --name spring-rag-proxy-uami --resource-group <rg>
PROXY_UAMI=$(az identity show --name spring-rag-proxy-uami --resource-group <rg> --query id -o tsv)
PROXY_UAMI_CLIENT_ID=$(az identity show --name spring-rag-proxy-uami --resource-group <rg> --query clientId -o tsv)

# Create the proxy app — internal ingress, same env as orchestrator
az containerapp create \
  --name spring-rag-proxy \
  --resource-group <rg> \
  --environment $ENV_NAME \
  --image $ACR_LOGIN/spring-rag-proxy:latest \
  --target-port 8080 \
  --ingress internal \
  --transport auto \
  --user-assigned $PROXY_UAMI \
  --registry-server $ACR_LOGIN \
  --registry-identity $PROXY_UAMI \
  --env-vars \
    AZURE_CLIENT_ID=$PROXY_UAMI_CLIENT_ID \
    APP_CONFIG_ENDPOINT=$APP_CFG \
    SPRING_PROFILES_ACTIVE=prod \
    ORCHESTRATOR_URL=https://gpt-rag-orchestrator.internal.<env-id>.<region>.azurecontainerapps.io/orchestrator \
  --min-replicas 1 \
  --max-replicas 10
```

Both apps now share the same Container Apps Environment. Container Apps DNS resolves the `internal.*.azurecontainerapps.io` FQDN inside the env — no public hop, traffic stays in the VNET.

### 3.4 Grant the proxy's UAMI the rights it needs

Same pattern the orchestrator uses (`scripts/deploy.ps1` reads these from App Config):

```bash
# Read App Configuration values
az role assignment create --assignee $PROXY_UAMI_CLIENT_ID \
  --role "App Configuration Data Reader" \
  --scope $(az appconfig show --name $APP_CFG_NAME --query id -o tsv)

# Pull from private ACR
az role assignment create --assignee $PROXY_UAMI_CLIENT_ID \
  --role "AcrPull" \
  --scope $(az acr show --name $ACR_NAME --query id -o tsv)

# Read secrets from Key Vault (if Spring needs any)
KV_NAME=$(az appconfig kv show --name $APP_CFG_NAME --label gpt-rag \
           --key KEY_VAULT_NAME --query value -o tsv 2>/dev/null)
if [ -n "$KV_NAME" ]; then
  az role assignment create --assignee $PROXY_UAMI_CLIENT_ID \
    --role "Key Vault Secrets User" \
    --scope $(az keyvault show --name $KV_NAME --query id -o tsv)
fi
```

### 3.5 Entra ID app registrations (three-tier, OBO chain)

You need three registrations. Two probably exist (orchestrator-api was created by GPT-RAG infra; SPA may or may not). Add the Spring middle tier.

```
SPA (Vue)          ──[user JWT for spring-api/.default]──▶  Spring API (proxy)
                                                              │ OBO exchange
                                                              ▼
                                                          [user JWT for orchestrator-api/.default]
                                                              │
                                                              ▼
                                                          Orchestrator API
```

| App registration | Type | Exposes | Has API permission to |
|---|---|---|---|
| `gpt-rag-orchestrator-api` (exists) | Web API | scope `access_as_user` | Microsoft Graph User.Read; downstream services as needed |
| `spring-rag-proxy-api` (NEW) | Web API | scope `access_as_user` | `gpt-rag-orchestrator-api/access_as_user` (Delegated) |
| `vue-rag-spa` (NEW or existing) | SPA | — | `spring-rag-proxy-api/access_as_user` (Delegated) |

For each "Has API permission to" row: grant **admin consent** in the tenant (otherwise OBO returns `AADSTS65001`).

OBO requires Spring proxy to **also** have a client secret (or federated credential — preferred in zero-trust):

```bash
# Federated credential — no secret to rotate
az ad app federated-credential create \
  --id <spring-api-app-id> \
  --parameters '{
    "name": "uami-spring-rag-proxy",
    "issuer": "https://login.microsoftonline.com/<tenant>/v2.0",
    "subject": "/subscriptions/<sub>/resourcegroups/<rg>/providers/Microsoft.ManagedIdentity/userAssignedIdentities/spring-rag-proxy-uami",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

This lets Spring's UAMI assert itself as the API app for the OBO call, no secrets in Key Vault.

### 3.6 Spring proxy `application.yml` (prod profile)

```yaml
spring:
  profiles:
    active: prod
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://login.microsoftonline.com/${app.entra.tenant-id}/v2.0
          audiences:
            - api://${app.entra.client-id}

app:
  entra:
    tenant-id: ${ENTRA_TENANT_ID}
    client-id: ${SPRING_API_CLIENT_ID}             # spring-rag-proxy-api
  orchestrator:
    url: ${ORCHESTRATOR_URL}                       # internal FQDN, no public hop
    timeout-ms: 240000                             # 4 min — agentic flows can run long
    obo-scope: api://${ORCH_API_CLIENT_ID}/.default
  cors:
    allowed-origins: https://app.contoso.com       # your front-door / SWA host
  dev-doubles:
    enabled: false                                 # CRITICAL — MockOrchestratorClient must NOT load
```

The `app.dev-doubles.enabled: false` line is load-bearing. The Junie skill's `DevDoubleClasspathScanTest` and `DevDoubleGateTest` (Phase 03 Unit 9b) ensure the mock is profile-gated. Re-running those tests in CI before each prod push is the only way to guarantee the gate held.

### 3.7 Vue `.env.production`

```
VITE_RAG_API_URL=https://app.contoso.com/api
VITE_MSAL_CLIENT_ID=<vue-rag-spa-client-id>
VITE_MSAL_AUTHORITY=https://login.microsoftonline.com/<tenant-id>
VITE_MSAL_REDIRECT_URI=https://app.contoso.com
VITE_API_SCOPE=api://<spring-api-client-id>/.default
```

`VITE_API_SCOPE` targets the **Spring proxy's** scope, NOT the orchestrator's. The OBO chain handles the second hop server-side.

`src/auth/msalConfig.js` (generated by Phase 04 Step 6) validates these at startup. Placeholders fail fast at the config-error screen.

```bash
cd frontend
pnpm install
pnpm build                # → dist/

# Deploy to Static Web App
az staticwebapp create \
  --name vue-rag-client \
  --resource-group <rg> \
  --source ./frontend \
  --branch main \
  --app-location "/" \
  --output-location "dist" \
  --location <region>
```

### 3.8 Front Door / App Gateway routing

Two backends:

| Path | Backend | Notes |
|---|---|---|
| `/` (default) | Static Web App `vue-rag-client` | serves `index.html` + assets |
| `/api/*` | Spring proxy via Container Apps internal load balancer | strip `/api` prefix in route |

Sample App Gateway path map (key fragment):

```jsonc
{
  "pathRules": [
    {
      "name": "spa",
      "paths": ["/", "/assets/*", "/index.html"],
      "backendAddressPool": "swa-backend"
    },
    {
      "name": "api",
      "paths": ["/api/*"],
      "backendAddressPool": "spring-proxy-backend",
      "rewriteRuleSet": "strip-api-prefix"      // /api/rag/ask → /rag/ask
    }
  ]
}
```

Or with Front Door rules engine, the equivalent path-based routing.

WAF rules to enable:
- OWASP CRS 3.2 in Prevention mode
- Custom rule: rate-limit `/api/rag/ask` to ~10 req/min/IP (RAG is expensive)
- Geo-filter if applicable

### 3.9 SSE through the public edge

Three separate hops can each break SSE. Audit each:

| Hop | Default behavior | Action |
|---|---|---|
| Front Door | buffers responses | use **Premium** tier OR set route caching `disabled` and use HTTP/2 |
| App Gateway | response timeout default 30s | bump `Backend HTTP settings → Request timeout` to ≥240s |
| Container Apps ingress | 240s timeout | override via `--ingress.timeout` if you need longer |
| Spring `RagController` | OK | already sets `Cache-Control: no-cache, no-transform`, `Connection: keep-alive` |

Send a heartbeat event every 10–15s in the SSE stream during long agentic runs. The Junie-scaffolded `useSseClient.js` already tolerates them; orchestrator's MAF strategy emits `event: ping` between agent steps.

### 3.10 CORS — only in Spring, not in Container Apps

Three-layer CORS will fight you in zero-trust:
- WAF strips/forwards headers based on rules
- Container Apps adds an ingress CORS layer
- Spring SecurityConfig adds another

Enable only the **Spring** layer. Disable the others to avoid duplicate `Access-Control-Allow-Origin` headers (browser then rejects):

```bash
az containerapp ingress cors disable --name spring-rag-proxy --resource-group <rg>
az containerapp ingress cors disable --name gpt-rag-orchestrator --resource-group <rg>
```

In Spring `SecurityConfig.kt`, generated by Phase 03 Unit 6, `app.cors.allowed-origins` is the single source of truth.

---

## 4. End-to-end smoke test

```bash
# 1. Check orchestrator reachable from Spring (must run from inside Container App, not laptop)
az containerapp exec --name spring-rag-proxy --resource-group <rg> --command \
  "curl -sS -o /dev/null -w '%{http_code}\n' \
     -X POST $ORCHESTRATOR_URL \
     -H 'Authorization: Bearer dummy' \
     -H 'Content-Type: application/json' \
     -d '{\"ask\":\"ping\"}'"
# Expect 401 (auth working) — NOT timeout (network broken)

# 2. Hit Spring from outside via WAF
curl -sSI https://app.contoso.com/api/actuator/health
# Expect 200

# 3. Open SPA, sign in, submit a query, watch logs
az containerapp logs show --name spring-rag-proxy --resource-group <rg> --follow
az containerapp logs show --name gpt-rag-orchestrator --resource-group <rg> --follow
```

Expected log on a successful end-to-end query (orchestrator side):

```
[Orchestrator] ✅ Authenticated request: conversation_id=... user=jdoe@contoso.com oid=...
[Timing][main.py] Orchestrator.create took 0.218s
... agentic strategy emits SSE chunks ...
```

If you see `[Orchestrator] Authentication required (ALLOW_ANONYMOUS=false) but Entra auth is not configured` — the orchestrator's App Configuration is missing `OAUTH_AZURE_AD_TENANT_ID` / `OAUTH_AZURE_AD_CLIENT_ID`. Fix in App Config, then **restart the orchestrator container app** (config is read at startup):

```bash
az containerapp revision restart --name gpt-rag-orchestrator --resource-group <rg>
```

---

## 5. Zero-trust-specific gotchas

These come up because of the GPT-RAG infra's posture, not Junie's scaffold:

### 5.1 No `azd provision`

`scripts/preProvision.ps1` and `scripts/preProvision.sh` exit with code 1 — `azd up` is intentionally blocked. You must run the `Azure/GPT-RAG` infra deployment first, then `azd env refresh -e <env>` to populate local env, then `azd deploy`.

The same constraint applies to your Spring proxy: do not co-locate its bicep with the orchestrator. Either add it to the GPT-RAG infra repo as a module, or provision it separately with `az containerapp create` against the same env.

### 5.2 ACR is private — can't push from a laptop on a coffee-shop network

Three options:
1. **VPN** into the corp VNET, push directly
2. **Azure DevOps / GitHub Actions self-hosted runner** inside the VNET
3. **`az acr build`** — sends source tarball to ACR Tasks, build runs in the registry's VNET. Same fallback the orchestrator's `scripts/deploy.ps1` uses when local Docker is unreachable

### 5.3 Container Apps internal DNS

`gpt-rag-orchestrator.internal.<env-id>.<region>.azurecontainerapps.io` only resolves:
- From inside the Container Apps Environment (other apps in the same env)
- From the VNET the env is injected into (peered VNETs work too)

Your laptop will get NXDOMAIN. Don't waste 30 min thinking the orchestrator is broken.

### 5.4 OBO needs a credential, not just a UAMI

`OnBehalfOfCredential` (Java SDK side) requires either a client secret or federated credential against the **app registration**, not against the UAMI. Federated credential setup in §3.5 is the zero-trust-clean path — no secret to rotate, no Key Vault round-trip.

### 5.5 Token in memory only — do not log it

The orchestrator deliberately keeps `request_access_token` off conversation documents (see `Orchestrator.create()` comment: *"Do not store it in conversation documents"*). Mirror this in Spring: never log the bearer token, never put it in MDC, never echo it in error responses. The Junie scaffold's `RagController` filters `Authorization` from error bodies — keep it that way.

### 5.6 App Insights / log scrubbing

`scripts/check-auth-policy.mjs` blocks `localStorage.setItem('*token*')` and `STUB`/dummy fallback patterns at CI time. Add equivalent log-redaction for App Insights:
- Telemetry processor that strips `Authorization` header values
- Custom dimension allowlist (block `oid`, `preferred_username` if your compliance scope rejects PII in logs)

### 5.7 Private endpoints + JWKS fetch

`validate_access_token()` fetches JWKS from `https://login.microsoftonline.com/<tenant>/discovery/v2.0/keys`. This is a public Microsoft endpoint — your VNET egress must allow it. If you hard-block all public egress, allowlist:
- `login.microsoftonline.com` (JWKS, OIDC discovery)
- `graph.microsoft.com` (`get_user_groups_from_graph` if you use group-based RBAC)
- `*.openai.azure.com` if Azure OpenAI is used (private endpoint preferred — set up via GPT-RAG infra)
- `*.search.windows.net` likewise

JWKS fetch caches per `Cache-Control: max-age` from Microsoft. If outbound egress goes through a forward proxy that strips/rewrites cache headers, you'll see hot-loop JWKS fetches in logs — fix the proxy, don't disable cache.

### 5.8 Cold starts kill SSE handshakes

Container Apps scales to zero by default. First request after idle takes 5–15s for orchestrator cold start. SSE clients with short `Connection-Setup` timeouts will give up.

For the orchestrator and Spring proxy, set `--min-replicas 1` (you already have it for orchestrator from GPT-RAG infra defaults; verify with `az containerapp show`).

---

## 6. Final checklist

Before you let real users in:

- [ ] `ALLOW_ANONYMOUS=false` in App Configuration, orchestrator restarted
- [ ] `OAUTH_AZURE_AD_TENANT_ID` and `OAUTH_AZURE_AD_CLIENT_ID` set, audience matches inbound tokens
- [ ] Three Entra app registrations exist; admin consent granted on all delegated permissions
- [ ] Federated credential wired between Spring's UAMI and Spring's API app registration
- [ ] Spring `app.dev-doubles.enabled=false` in prod profile (verify `MockOrchestratorClient` does NOT appear in `az containerapp logs show` startup banner)
- [ ] Orchestrator Container App ingress is `internal` (verified §3.1)
- [ ] Spring proxy in same Container Apps Environment, internal ingress
- [ ] Front Door / App Gateway routes `/` → SWA, `/api/*` → Spring proxy
- [ ] WAF in Prevention mode, OWASP CRS 3.2, rate-limit on `/api/rag/ask`
- [ ] CORS only configured in Spring, disabled at Container Apps ingress
- [ ] SSE timeouts ≥240s at every hop (Front Door, App Gateway, Container Apps)
- [ ] `--min-replicas 1` on both Container Apps
- [ ] Vue `.env.production` `VITE_API_SCOPE` targets Spring (NOT orchestrator)
- [ ] `VITE_MSAL_REDIRECT_URI` matches the Front Door / SWA public hostname exactly
- [ ] CI pipeline runs `node scripts/check-auth-policy.mjs` + `check-r5-invariant.mjs` + `check-stack-invariant.mjs` + `tests/invariants/run-harness.mjs`
- [ ] CI pipeline runs `frontend/contract-tests/leak.spec.js` against built `dist/` (no STUB tokens, no localStorage token writes)
- [ ] App Insights telemetry processor strips `Authorization` headers
- [ ] No bearer token logged anywhere (grep your own log output before shipping)
- [ ] JWKS endpoint reachable from VNET egress (test with `az containerapp exec`)
- [ ] Cosmos DB conversations container has TTL set (compliance — orchestrator does not auto-purge)

---

## 7. URL cheat-sheet

```
End-user                    https://app.contoso.com
Vue SPA (SWA)               https://vue-rag-client.azurestaticapps.net
Front Door / App Gateway    https://app.contoso.com (public DNS)
Spring proxy (internal)     https://spring-rag-proxy.internal.<env>.<region>.azurecontainerapps.io
Orchestrator (internal)     https://gpt-rag-orchestrator.internal.<env>.<region>.azurecontainerapps.io
Orchestrator endpoint       POST /orchestrator (SSE, requires Bearer)

Entra
  Tenant                    <tenant-id>
  SPA app                   <vue-rag-spa-client-id>
  Spring API app            <spring-api-client-id>          (audience for SPA token)
  Orchestrator API app      <orch-api-client-id>            (audience for OBO-exchanged token)

App Configuration
  Endpoint                  https://<appcfg>.azconfig.io
  Label                     gpt-rag
  Required keys             OAUTH_AZURE_AD_TENANT_ID, OAUTH_AZURE_AD_CLIENT_ID,
                            ALLOW_ANONYMOUS, AGENT_STRATEGY,
                            CONTAINER_REGISTRY_NAME, CONTAINER_REGISTRY_LOGIN_SERVER,
                            AZURE_RESOURCE_GROUP, ORCHESTRATOR_APP_NAME
```

That is the full picture. Wire each component once and the system is durable.
