# Playbook: 03 — Backend Scaffold (TDD)

**Purpose:** Generate `backend/` tree (Kotlin + Spring Boot WebFlux) with tests first, per TDD discipline. Adopt testing conventions from `REFERENCE_BRIEF.md`. Generate OpenAPI documentation.

**Input:** `SCAFFOLD_DECISIONS.md`, `REFERENCE_BRIEF.md` (optional), [INTEGRATION_PLAN.md](../../INTEGRATION_PLAN.md).

**Output:** `backend/` with 9 TDD units, `docs/backend-openapi.json`, test report, updated `SCAFFOLD_PROGRESS.md`.

---

## Step 1 — Setup & test framework selection

Read `SCAFFOLD_DECISIONS.md` to unlock JDK version, Kotlin version, and add-ons.

If `REFERENCE_BRIEF.md` exists, scan for:
- **Test framework:** JUnit 5 / JUnit 4 / other. Adopt it.
- **Mocking library:** Mockito / MockK. Match it.
- **Spring test mode:** `@WebFluxTest` / `@SpringBootTest`. Match patterns.
- **Testcontainers** presence → if add-on selected, use it for integration tests.

If no reference, **default to:**
- Test framework: **JUnit 5** (modern, parameterized tests)
- Mocking: **MockK** (Kotlin-native, cleaner syntax)
- Spring test: **@WebFluxTest** for unit tests, **@SpringBootTest** for integration
- DB testing: Testcontainers for PostgreSQL / MongoDB if opted in

### Generate `backend/build.gradle.kts`

Include exact deps from [INTEGRATION_PLAN.md §5.1](../../INTEGRATION_PLAN.md), bumped per SCAFFOLD_DECISIONS.md:
- Spring Boot starter-webflux, security, oauth2-resource-server, actuator, validation
- Kotlin extensions, reactor-kotlin
- Resilience4j for circuit breaker
- Azure identity
- MCP SDK (if opted in)
- Test deps: JUnit 5, MockK, spring-boot-starter-test, reactor-test, testcontainers (if opted)

### Generate config files

- `src/main/kotlin/com/example/rag/RagApplication.kt` — main entry point
- `application.yml` — profiles (dev, test), logging, actuator settings
- `application-dev.yml` — local orchestrator stub, CORS dev
- `application-test.yml` — in-memory config for tests

### Generate package structure

```
backend/src/main/kotlin/com/example/rag/
├── RagApplication.kt
├── config/
│   ├── SecurityConfig.kt
│   ├── WebClientConfig.kt
│   └── OrchestratorProperties.kt
├── web/
│   ├── RagController.kt
│   ├── ToolController.kt
│   └── dto/
│       ├── AskRequest.kt
│       └── AskChunk.kt
├── service/
│   ├── OrchestratorClient.kt
│   ├── SseEnvelopeMapper.kt
│   ├── UserContextBuilder.kt
│   └── ConversationService.kt
└── tools/
    ├── ToolRegistry.kt
    └── impl/
        └── CreateTicketTool.kt
```

Print to user:

```
Generated backend/ structure.
- Kotlin: <1.9/2.0>
- JDK: <17/21/23>
- Test framework: <JUnit 5 + MockK>
- Config files ready.

Now running TDD loop (9 units, red → green per unit).
Watch for test output.
```

---

## Step 2 — TDD Loop (units 1–9)

**Discipline:** Same as frontend — for EACH unit:
1. Write a **failing test** (red).
2. Show test failure output.
3. Implement minimum code to pass.
4. Show test pass output.
5. Refactor, commit: `test(rag-be): <unit-name> — TDD green`.

**Testing conventions:** Adopt from REFERENCE_BRIEF (JUnit 5, MockK, etc.). If missing, use defaults (JUnit 5 + MockK + @WebFluxTest).

**Naming conventions:** Infer from REFERENCE_BRIEF (DTO suffixes, class naming). If missing, ask user:
> Before implementing DTOs, confirm naming conventions:
> - Suffix for request DTOs? (Request / Dto / Command)
> - Suffix for response DTOs? (Response / Dto / Result)
> - Package layout: flat / layered?
> (Offer reference patterns or defaults: Request/Response suffix, layered by responsibility.)

### Unit 1: DTOs (request/response contracts)

**Files:**
- `src/main/kotlin/.../web/dto/AskRequest.kt`
- `src/main/kotlin/.../web/dto/AskChunk.kt` (sealed class)
- `src/main/kotlin/.../web/dto/Citation.kt`

**Behavior to test:**
- Jackson serialization round-trip (object → JSON → object).
- Discriminator `type` field present on AskChunk subtypes.
- Validation annotations work (e.g., `@NotBlank` on `ask` field).

**Red test:**
```kotlin
// backend/src/test/kotlin/.../web/dto/AskChunkTest.kt
@Test
fun `AskChunk.Chunk serializes with type discriminator`() {
  val chunk = AskChunk.Chunk("Hello")
  val json = ObjectMapper().writeValueAsString(chunk)
  assertThat(json).contains("""type":"chunk""")
}
```

**Green implementation:** Data classes + Jackson `@JsonTypeInfo` for sealed class discrimination.

---

### Units 2–9: Follow the same discipline

**Unit 2:** `SseEnvelopeMapper` — raw text → AskChunk events (regex extraction, citation parsing).  
**Unit 3:** `UserContextBuilder` — JWT claims → user context.  
**Unit 4:** `OrchestratorProperties` — `@ConfigurationProperties` binding + validation.  
**Unit 5:** `OrchestratorClient` — WebClient SSE streaming (MockWebServer tests).  
**Unit 6:** `SecurityConfig` — JWT resource server + CORS (MockJwt tests).  
**Unit 7:** `RagController` — `POST /api/rag/ask` SSE streaming (WebTestClient).  
**Unit 8:** `ToolController` + `ToolRegistry` + sample `CreateTicketTool`.  
**Unit 9:** (If MCP opted in) `McpServer`, `McpMessageHandler` — MCP protocol.

After each unit:
- Show test output (✅ pass / ❌ fail).
- Print lines added/modified.
- Commit: `test(rag-be): <name> — TDD green`.

**Test data:** Use realistic samples from [INTEGRATION_PLAN.md §3](../../INTEGRATION_PLAN.md) request/response examples.

---

### Unit 9b: Profile-gated dev-double + OBO JWT integration tests

**Stack constraint (read first — non-negotiable).** This unit assumes the locked stack: **Kotlin + Spring Boot WebFlux** (not Spring MVC / servlet). Every code template below uses **reactive** Spring Security types (`ServerHttpSecurity`, `SecurityWebFilterChain`, `ReactiveJwtDecoder`, `WebTestClient`). Servlet imports (`HttpSecurity`, `SecurityFilterChain`, `JwtDecoder`, `MockMvc`, `jakarta.servlet.*`) are forbidden and `scripts/check-stack-invariant.mjs` fails the build if any appear in a Kotlin code block in this playbook. If the locked stack ever changes, every snippet here is re-evaluated under the security-correctness dependency noted in `.junie/guidelines.md`.

**Why this unit exists.** Frontend hardening (playbook 04 leak test) is decorative without a matching backend gate plus real token validation on the wire. This unit closes both: (a) every dev/test-double bean is property-gated fail-closed, and (b) `oauth2ResourceServer().jwt()` is wired with JWKS URI, audience, and issuer so unsigned/forged tokens are rejected at the boundary. The two integration tests below — `DevDoubleGateTest` and `OboValidationTest` — fail the build whenever either gate regresses.

**Files:**
- `src/main/kotlin/com/example/config/annotations/DevOnlyBean.kt`
- `src/main/kotlin/com/example/config/SecurityConfig.kt` (extend Unit 6 output)
- `src/main/resources/application.yml` (add `app.dev-doubles.enabled` + `app.entra.*` properties)
- `src/test/kotlin/com/example/config/DevDoubleGateTest.kt`
- `src/test/kotlin/com/example/security/OboValidationTest.kt`

#### Step A — Define the `@DevOnlyBean` meta-annotation (load-bearing primary control)

A single class-level `@ConditionalOnProperty` on a `@Configuration` class does not auto-cascade to its `@Bean` methods unless the methods are individually annotated. To make the property gate cascade uniformly across both top-level `@Component` classes AND `@Bean` methods inside `@Configuration` classes, define `@DevOnlyBean` as a Spring **meta-annotation** that itself carries the `@ConditionalOnProperty`. Anywhere `@DevOnlyBean` is placed — class or method — the property check rides along.

This cascading behavior is why we need a meta-annotation rather than a plain marker. A plain marker would force authors to remember to add `@ConditionalOnProperty` on every site, which is exactly the bypass we are trying to prevent.

**Convention:** every dev/test-double bean class OR `@Bean` method MUST carry `@DevOnlyBean`. The bean-name regex check in `DevDoubleGateTest` (Step C) is defense-in-depth for the case where someone forgets the marker.

```kotlin
// src/main/kotlin/com/example/config/annotations/DevOnlyBean.kt
package com.example.config.annotations

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import java.lang.annotation.ElementType
import java.lang.annotation.Retention
import java.lang.annotation.RetentionPolicy
import java.lang.annotation.Target

/**
 * Meta-annotation marking a bean (class) or @Bean method as a dev/test double.
 *
 * Composes @ConditionalOnProperty(name = "app.dev-doubles.enabled",
 *   havingValue = "true", matchIfMissing = false) so the property gate cascades
 * to @Bean methods inside @Configuration classes — not just to top-level
 * @Component classes. Fail-closed: if the property is unset, the bean is NOT
 * registered.
 *
 * Convention: every dev/test-double bean MUST carry this annotation.
 * DevDoubleGateTest fails the build if a bean carrying this annotation
 * registers without app.dev-doubles.enabled=true.
 */
@Target(ElementType.TYPE, ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@ConditionalOnProperty(
    name = ["app.dev-doubles.enabled"],
    havingValue = "true",
    matchIfMissing = false,
)
annotation class DevOnlyBean
```

**Usage at the bean site (class-level):**

```kotlin
// e.g., src/main/kotlin/com/example/dev/MockOrchestratorClient.kt
@DevOnlyBean
@Component
class MockOrchestratorClient : OrchestratorClient { /* ... */ }
```

**Usage at the bean site (method-level — why the meta-annotation matters):**

```kotlin
@Configuration
class DevDoublesConfig {
    @DevOnlyBean   // the @ConditionalOnProperty cascades from the meta-annotation
    @Bean
    fun fakeAuthClient(): AuthClient = FakeAuthClient()
}
```

#### Step B — Property convention (`application.yml`)

| Profile / file | `app.dev-doubles.enabled` |
|---|---|
| `application.yml` (production default) | `false` (explicit) |
| `application-test.yml` | unset (or `false`) |
| `application-dev.yml` | `true` |

```yaml
# application.yml (production default — explicit fail-closed)
app:
  dev-doubles:
    enabled: false
  entra:
    jwks-uri: ${ENTRA_JWKS_URI}      # no default — missing → app fails to start
    audience: ${ENTRA_AUDIENCE}       # no default
    issuer: ${ENTRA_ISSUER}           # no default
```

Production sets `app.dev-doubles.enabled=false` explicitly. Test context leaves it unset (treated as `false` because `matchIfMissing = false`). Only the `dev` profile flips it to `true`.

#### Step C — `DevDoubleGateTest` (R7b): use `ApplicationContextRunner`, NOT `@SpringBootTest`

**Why `ApplicationContextRunner`.** `@SpringBootTest` boots the full application context. If a collaborator depends on a dev-double-only bean (legitimately gated off in this test), `@SpringBootTest` fails to bootstrap with `NoSuchBeanDefinitionException` — masquerading as a gate failure when it is really a context-wiring problem. `ApplicationContextRunner` lets the test load only the relevant configuration (sliced context), so we are testing the gate, not the wiring.

The test has TWO assertions, run with `app.dev-doubles.enabled` UNSET:

1. No bean carrying `@DevOnlyBean` registers.
2. No bean whose simple class name matches the case-insensitive regex `(?i)^(Mock|Stub|Fake|Spy|Dummy|TestDouble|InMemory|Noop)` registers.

**Bean-name regex (literal):** `(?i)^(Mock|Stub|Fake|Spy|Dummy|TestDouble|InMemory|Noop)`

**Documented false-positive class.** A bean named `MockingjayController` would match this regex and the test would (correctly, per its design) fail. The marker annotation `@DevOnlyBean` is the load-bearing primary control; the regex is defense-in-depth. Teams that hit a legitimate false positive should rename the bean OR refine the regex with a word-boundary tweak, but they MUST keep the marker check primary — the regex alone is not sufficient because it cannot detect well-named-but-still-fake beans.

```kotlin
// src/test/kotlin/com/example/config/DevDoubleGateTest.kt
package com.example.config

import com.example.config.annotations.DevOnlyBean
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.autoconfigure.AutoConfigurations
import org.springframework.boot.test.context.runner.ApplicationContextRunner

class DevDoubleGateTest {

    private val devDoubleNamePattern =
        Regex("^(Mock|Stub|Fake|Spy|Dummy|TestDouble|InMemory|Noop)", RegexOption.IGNORE_CASE)

    private val contextRunner: ApplicationContextRunner = ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(/* the production config slice under test */))
        // NOTE: app.dev-doubles.enabled is intentionally NOT set here.
        // matchIfMissing = false on the meta-annotation makes the absence fail-closed.

    @Test
    fun `no @DevOnlyBean-marked bean registers when app dev-doubles enabled is unset`() {
        contextRunner.run { context ->
            val markedBeans = context.getBeansWithAnnotation(DevOnlyBean::class.java).keys
            assertThat(markedBeans)
                .withFailMessage(
                    "FAIL THE BUILD: dev-double beans registered without " +
                        "app.dev-doubles.enabled=true. Offending: %s",
                    markedBeans,
                )
                .isEmpty()
        }
    }

    @Test
    fun `no bean whose simple class name matches the dev-double regex registers`() {
        contextRunner.run { context ->
            val offenders = context.beanDefinitionNames
                .mapNotNull { name -> runCatching { context.getBean(name)::class.java.simpleName to name }.getOrNull() }
                .filter { (simpleName, _) -> devDoubleNamePattern.containsMatchIn(simpleName) }
                .map { (simpleName, beanName) -> "$beanName (class=$simpleName)" }

            assertThat(offenders)
                .withFailMessage(
                    "FAIL THE BUILD: bean(s) match dev-double name regex " +
                        "(?i)^(Mock|Stub|Fake|Spy|Dummy|TestDouble|InMemory|Noop) without the gate. " +
                        "Offenders: %s. If this is a legitimate false positive (e.g., MockingjayController), " +
                        "rename the bean or refine the regex — but keep @DevOnlyBean as the primary control.",
                    offenders,
                )
                .isEmpty()
        }
    }
}
```

**Failure modes this test catches:**
- A developer adds `@Component class MockFooClient` without `@DevOnlyBean` → name regex fires.
- A developer adds `@DevOnlyBean class FakeAuthClient` but the property gate misfires → annotation check fires.
- A developer hand-rolls `@ConditionalOnProperty` on a class but forgets the marker → name regex fires (defense-in-depth).
- Bean named `MockingjayController` registers → test correctly fires (documented false positive — rename or refine regex; do NOT remove marker check).

**Integration check (no regression of dev workflow):** with `app.dev-doubles.enabled=true` set on the runner via `.withPropertyValues("app.dev-doubles.enabled=true")`, dev-double beans DO load — confirm by switching the runner config in a separate test method.

#### Step D — OBO JWT validation in `SecurityConfig` (R6c) — **WebFlux reactive**

Spring Security reactive `oauth2ResourceServer().jwt()` is configured against the Entra ID JWKS URI with required `aud` and expected `iss`. Properties have **no defaults** — a missing property fails the app at startup, not at first request. This prevents silent acceptance of unsigned tokens.

**Reactive types (do NOT use the servlet variants):**
- `ServerHttpSecurity` (not `HttpSecurity`)
- `SecurityWebFilterChain` (not `SecurityFilterChain`)
- `ReactiveJwtDecoder` (not `JwtDecoder`)
- `NimbusReactiveJwtDecoder` (not `NimbusJwtDecoder`)

**CSRF posture decision (same step):** disable CSRF for stateless JWT-authenticated endpoints via `http.csrf { it.disable() }` on `ServerHttpSecurity`. Safety rationale: CSRF defends against cookie-based credential injection (browsers auto-attach cookies to cross-origin requests). Bearer headers cannot be auto-injected cross-origin — the attacker cannot read the token from another origin (CORS) and cannot make the browser attach it (no equivalent of `SameSite` for `Authorization`). For a stateless JWT API with no cookie auth, CSRF protection is theatre and breaks legitimate clients that don't fetch a CSRF token.

```kotlin
// src/main/kotlin/com/example/config/SecurityConfig.kt
package com.example.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity
import org.springframework.security.config.web.server.ServerHttpSecurity
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2TokenValidator
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtClaimValidator
import org.springframework.security.oauth2.jwt.JwtValidators
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder
import org.springframework.security.web.server.SecurityWebFilterChain

@Configuration
@EnableWebFluxSecurity
class SecurityConfig(
    @Value("\${app.entra.jwks-uri}") private val jwksUri: String,         // no default — missing → boot fails
    @Value("\${app.entra.audience}") private val expectedAudience: String, // required `aud` claim
    @Value("\${app.entra.issuer}")   private val expectedIssuer: String,   // expected `iss` claim
) {

    @Bean
    fun securityWebFilterChain(http: ServerHttpSecurity): SecurityWebFilterChain {
        return http
            // CSRF: disabled for stateless JWT endpoints. Bearer headers cannot be cross-origin-injected
            // by a browser (CORS prevents read; no auto-attach behavior for Authorization). CSRF only
            // matters for cookie-based credentials. See Unit 9b CSRF posture decision.
            .csrf { it.disable() }
            .authorizeExchange { exchanges ->
                exchanges.anyExchange().authenticated()
            }
            .oauth2ResourceServer { oauth2 ->
                oauth2.jwt { jwt -> jwt.jwtDecoder(reactiveJwtDecoder()) }
            }
            .build()
    }

    @Bean
    fun reactiveJwtDecoder(): ReactiveJwtDecoder {
        // JWKS-backed signature verification — keys fetched from Entra at the JWKS URI (reactive).
        val decoder = NimbusReactiveJwtDecoder.withJwkSetUri(jwksUri).build()

        // Validate iss claim
        val issValidator = JwtValidators.createDefaultWithIssuer(expectedIssuer)
        // Validate aud claim
        val audValidator: OAuth2TokenValidator<Jwt> = JwtClaimValidator("aud") { claim ->
            when (claim) {
                is String -> claim == expectedAudience
                is Collection<*> -> claim.contains(expectedAudience)
                else -> false
            }
        }
        decoder.setJwtValidator(DelegatingOAuth2TokenValidator(issValidator, audValidator))
        return decoder
    }
}
```

#### Step E — `JwtTestKit` (test util) + `OboValidationTest` (R7c): real wire-level rejection

This step is split into two artifacts: a deterministic JWT/JWKS fixture builder (`JwtTestKit.kt`) and the actual integration test (`OboValidationTest.kt`). Together they cover all six cases — if any returns 200 when it should be 401, the build fails.

**Required test dependencies (add to `build.gradle.kts`):**

```kotlin
testImplementation("org.springframework.boot:spring-boot-starter-test")
testImplementation("io.projectreactor:reactor-test")
testImplementation("com.nimbusds:nimbus-jose-jwt:9.40")              // RSA keypair + JWS signing
testImplementation("com.github.tomakehurst:wiremock-jre8:2.35.0")    // JWKS stub server
testImplementation("org.springframework.boot:spring-boot-starter-webflux")
testImplementation("org.springframework.security:spring-security-test")
```

**Token-generation choice (recommended option called out):**

1. **(RECOMMENDED) Stubbed JWK set served by WireMock + locally-signed JWT.** Test boots a WireMock server, points `app.entra.jwks-uri` at it, and WireMock returns a JWK set whose private key is held by the test. Test signs JWTs locally with that key. Pros: zero CI dependency on a live tenant; deterministic; fast. Cons: writes the most code (`JwtTestKit` below absorbs that cost once).
2. **Real Entra ID test tenant.** Fetches a real token from a dedicated test tenant during CI. Pros: validates against the real Entra contract. Cons: CI-credential cost (tenant creds, rate limits, network flakiness). Not recommended unless real-tenant drift is a primary risk.

The code below uses option 1.

##### `JwtTestKit.kt` — deterministic RSA + JWKS fixture builder

```kotlin
// src/test/kotlin/com/example/security/JwtTestKit.kt
package com.example.security

import com.github.tomakehurst.wiremock.WireMockServer
import com.github.tomakehurst.wiremock.client.WireMock.aResponse
import com.github.tomakehurst.wiremock.client.WireMock.get
import com.github.tomakehurst.wiremock.client.WireMock.urlPathMatching
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.RSASSASigner
import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.RSAKey
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import java.time.Instant
import java.util.Date
import java.util.UUID

/**
 * Deterministic JWT + JWKS test fixtures. Two RSA keypairs:
 *   - `legitimate` is published in the WireMock JWKS endpoint
 *   - `attacker`   is NEVER published; signing with it produces a forged token
 *
 * All builders return real, structurally-valid, signed JWT strings — no TODOs.
 */
object JwtTestKit {

    val legitimate: RSAKey = RSAKeyGenerator(2048).keyID("legit-key-1").generate()
    val attacker: RSAKey   = RSAKeyGenerator(2048).keyID("attacker-key-1").generate()

    /** Public-only JWK set (what WireMock serves). The attacker key is excluded by design. */
    fun publishedJwkSet(): JWKSet = JWKSet(legitimate.toPublicJWK())

    /** Wire WireMock to serve `publishedJwkSet()` at the given path. */
    fun stubJwks(server: WireMockServer, path: String = "/.well-known/jwks.json") {
        server.stubFor(
            get(urlPathMatching(path)).willReturn(
                aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody(publishedJwkSet().toString())
            )
        )
    }

    /** Sign a JWT with the legitimate key and the given claims. */
    fun sign(
        signer: RSAKey = legitimate,
        audience: String,
        issuer: String,
        subject: String = "test-user",
        expiresIn: java.time.Duration = java.time.Duration.ofMinutes(5),
    ): String {
        val claims = JWTClaimsSet.Builder()
            .subject(subject)
            .audience(audience)
            .issuer(issuer)
            .jwtID(UUID.randomUUID().toString())
            .issueTime(Date.from(Instant.now()))
            .expirationTime(Date.from(Instant.now().plus(expiresIn)))
            .build()
        val header = JWSHeader.Builder(JWSAlgorithm.RS256).keyID(signer.keyID).build()
        return SignedJWT(header, claims).apply { sign(RSASSASigner(signer.toRSAPrivateKey())) }.serialize()
    }

    fun validJwt(audience: String, issuer: String): String =
        sign(audience = audience, issuer = issuer)

    fun forgedJwt(audience: String, issuer: String): String =
        // Same shape, but signed by the attacker key — JWKS lookup will not find a matching kid/key.
        sign(signer = attacker, audience = audience, issuer = issuer)

    fun wrongAudienceJwt(expectedAudience: String, issuer: String): String =
        sign(audience = "$expectedAudience.WRONG", issuer = issuer)

    fun wrongIssuerJwt(audience: String, expectedIssuer: String): String =
        sign(audience = audience, issuer = "$expectedIssuer/WRONG")

    /** A syntactically broken token (not even three base64 segments). */
    const val MALFORMED: String = "this.is.not-a-jwt"
}
```

##### `OboValidationTest.kt` — WebFlux + WebTestClient

```kotlin
// src/test/kotlin/com/example/security/OboValidationTest.kt
package com.example.security

import com.github.tomakehurst.wiremock.WireMockServer
import com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.reactive.server.WebTestClient

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OboValidationTest {

    @Autowired private lateinit var webClient: WebTestClient

    companion object {
        private const val AUDIENCE = "api://gpt-rag-orchestrator-test"
        private const val ISSUER   = "https://login.test.example/v2.0"

        private val wireMock: WireMockServer = WireMockServer(wireMockConfig().dynamicPort())

        @BeforeAll
        @JvmStatic
        fun startWireMock() {
            wireMock.start()
            JwtTestKit.stubJwks(wireMock)
        }

        @AfterAll
        @JvmStatic
        fun stopWireMock() {
            wireMock.stop()
        }

        /** Bind Spring properties at runtime so SecurityConfig points at WireMock + the test claims. */
        @JvmStatic
        @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            registry.add("app.entra.jwks-uri") { "${wireMock.baseUrl()}/.well-known/jwks.json" }
            registry.add("app.entra.audience") { AUDIENCE }
            registry.add("app.entra.issuer")   { ISSUER }
        }
    }

    @Test fun `no Authorization header returns 401`() {
        webClient.get().uri("/api/rag/ask").exchange().expectStatus().isUnauthorized
    }

    @Test fun `malformed JWT returns 401`() {
        webClient.get().uri("/api/rag/ask")
            .header("Authorization", "Bearer ${JwtTestKit.MALFORMED}")
            .exchange().expectStatus().isUnauthorized
    }

    @Test fun `forged JWT signed by wrong key returns 401`() {
        // Structurally valid; signature verification against JWKS fails because the attacker
        // key is never published in publishedJwkSet().
        val token = JwtTestKit.forgedJwt(audience = AUDIENCE, issuer = ISSUER)
        webClient.get().uri("/api/rag/ask")
            .header("Authorization", "Bearer $token")
            .exchange().expectStatus().isUnauthorized
    }

    @Test fun `JWT with wrong aud claim returns 401`() {
        val token = JwtTestKit.wrongAudienceJwt(expectedAudience = AUDIENCE, issuer = ISSUER)
        webClient.get().uri("/api/rag/ask")
            .header("Authorization", "Bearer $token")
            .exchange().expectStatus().isUnauthorized
    }

    @Test fun `JWT with wrong iss claim returns 401`() {
        val token = JwtTestKit.wrongIssuerJwt(audience = AUDIENCE, expectedIssuer = ISSUER)
        webClient.get().uri("/api/rag/ask")
            .header("Authorization", "Bearer $token")
            .exchange().expectStatus().isUnauthorized
    }

    @Test fun `valid JWT returns 200`() {
        val token = JwtTestKit.validJwt(audience = AUDIENCE, issuer = ISSUER)
        webClient.get().uri("/api/rag/ask")
            .header("Authorization", "Bearer $token")
            .exchange().expectStatus().isOk
    }
}
```

**No `TODO(...)` placeholders.** Every fixture is built deterministically from `JwtTestKit`. The forged path is signed by an in-memory keypair that is never published in the JWKS endpoint — `NimbusReactiveJwtDecoder` cannot resolve a matching `kid`/key and rejects the token, exactly as production would reject an attacker-signed JWT.

#### Step F — Commit pattern

Per existing TDD discipline:

1. `test(rag-be): DevOnlyBean meta-annotation + DevDoubleGateTest red`
2. `test(rag-be): DevOnlyBean meta-annotation + DevDoubleGateTest green`
3. `test(rag-be): SecurityConfig OBO JWT (jwks-uri, aud, iss) + OboValidationTest red`
4. `test(rag-be): SecurityConfig OBO JWT (jwks-uri, aud, iss) + OboValidationTest green`

#### Step G — Verification (this unit fails the build when…)

Both tests **fail the build** under the following conditions:

**`DevDoubleGateTest` fails the build when:**
- A `@DevOnlyBean`-marked bean registers without `app.dev-doubles.enabled=true`.
- A bean whose simple class name matches `(?i)^(Mock|Stub|Fake|Spy|Dummy|TestDouble|InMemory|Noop)` registers without the property set.

**`OboValidationTest` fails the build when:**
- A request without `Authorization` header returns anything other than 401.
- A malformed JWT, a forged JWT, a JWT with wrong `aud`, or a JWT with wrong `iss` returns anything other than 401.
- A valid JWT does NOT return 200.

---

## Step 3 — Integration with frontend

After `RagController` (unit 7) passes:
- Verify contract compliance: incoming request shape matches [§3.1](../../INTEGRATION_PLAN.md).
- Outgoing SSE event shape matches what frontend's `useSseClient` expects.
- Print sample request → response flow.

---

## Step 4 — Optional: Testcontainers setup (if opted in)

If user selected **testcontainers**:

- Add `testImplementation("org.testcontainers:testcontainers")` + PostgreSQL / MongoDB container images.
- Generate sample integration test for `OrchestratorClient` that:
  - Spins up a mock HTTP server (MockWebServer).
  - Tests WebClient.
- Document in troubleshooting: "To run integration tests, you need Docker running."

---

## Step 5 — Backend API documentation (OpenAPI)

Generate `docs/backend-openapi.json` + `docs/backend-openapi.md`:

```markdown
# Backend API Reference

Auto-generated from Spring Boot controllers.

## Endpoints

### POST /api/rag/ask
Stream RAG chat responses.

**Request headers:**
- `Authorization: Bearer <JWT>`
- `Accept: text/event-stream`

**Request body:**
\`\`\`json
{
  "ask": "What is the refund policy?",
  "conversationId": "uuid-optional",
  "userContext": { "department": "sales" }
}
\`\`\`

**Response (SSE):**
\`\`\`
data: {"type":"conversationId","value":"c-123"}
data: {"type":"chunk","text":"The refund..."}
data: {"type":"citation","title":"Manual","url":"https://..."}
data: {"type":"done"}
\`\`\`

(Auto-extract from `@RequestMapping`, `@PostMapping`, Javadoc)

### GET /tools
Discover available tools.

(Auto-extract endpoint definitions)

---

## Error handling

- `401 Unauthorized` — missing or invalid JWT
- `400 Bad Request` — invalid request body
- `502 Bad Gateway` — orchestrator unreachable
- `503 Service Unavailable` — auth service down

(Copy from code or `@ExceptionHandler`)

---

## Security

- All endpoints require valid JWT (Entra ID).
- SSE response streams are bound to the user's JWT identity (OBO flow).

---

## Configuration

See `application.yml` for properties:
- `orchestrator.url` — RAG orchestrator endpoint
- `orchestrator.api-key` — shared secret
- `app.security.allowed-principals` (optional) — allowlist
```

---

## Step 6 — Test report & commit summary

After all 9 units, print:

```
✅ BACKEND SCAFFOLD COMPLETE

Tests: 35/35 passed (9 units × ~3–4 assertions each)
Integration tests: (if testcontainers opted) 5/5 passed
Lint: 0 errors
Build: ✅ successful

Files created:
- backend/build.gradle.kts
- backend/src/main/kotlin/com/.../RagApplication.kt
- backend/src/main/kotlin/com/.../config/ (3 classes)
- backend/src/main/kotlin/com/.../web/ (controllers + DTOs)
- backend/src/main/kotlin/com/.../service/ (3 services)
- backend/src/main/kotlin/com/.../tools/ (registry + sample tool)
- backend/src/test/kotlin/com/.../web/RagControllerTest.kt
- ... (test files for all units)
- docs/backend-openapi.json

Commits:
- test(rag-be): DTOs — TDD green
- test(rag-be): SseEnvelopeMapper — TDD green
- ... (7 more)

Next: Run 04-Contract-Tests to validate frontend ↔ backend communication.
```

---

## Step 7 — Update SCAFFOLD_PROGRESS.md

Append memory checkpoint:

```markdown
## Phase 03 — Backend-Scaffold ✅ DONE

**Completed:** <timestamp>

| Unit | Tests | Status |
|---|---|---|
| 1. DTOs | 2/2 | ✅ |
| 2. SseEnvelopeMapper | 4/4 | ✅ |
| 3. UserContextBuilder | 3/3 | ✅ |
| 4. OrchestratorProperties | 2/2 | ✅ |
| 5. OrchestratorClient | 4/4 | ✅ |
| 6. SecurityConfig | 3/3 | ✅ |
| 7. RagController | 3/3 | ✅ |
| 8. ToolController | 3/3 | ✅ |
| 9. (MCP) | — | <skipped/✅> |

**Total:** 32/32 unit tests passed
**Integration tests:** (if testcontainers) 5/5 passed

**Docs:** `docs/backend-openapi.json` generated

**Next phase:** 04-Contract-Tests
```

---

## Guardrails

- **TDD non-negotiable:** Show red, show green. No shortcuts.
- **WebClient timeout:** Set aggressive timeouts for SSE (30s default, configurable).
- **No token logging:** Never log full JWTs. Only log `token-type=Bearer, exp=<timestamp>`.
- **Error envelope:** Use RFC 7807 `application/problem+json` for 4xx/5xx responses.
- **Testcontainers best practice:** If integration tests fail, check Docker status first (`docker ps`).
