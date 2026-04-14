# Playbook: 04 — Contract Tests & Communication Fallbacks

**Purpose:** Generate JSON-schema contracts for SSE events, validate frontend ↔ backend communication, set up mocks/fallbacks for offline dev, document failure scenarios.

**Input:** `SCAFFOLD_DECISIONS.md`, completed `frontend/` + `backend/`, [INTEGRATION_PLAN.md §3](../../INTEGRATION_PLAN.md).

**Output:** `contract-tests/`, `docs/communication-fallbacks.md`, test report, updated `SCAFFOLD_PROGRESS.md`.

---

## Step 1 — JSON-schema generation

For each event type in `AskChunk` ([INTEGRATION_PLAN.md §3.1](../../INTEGRATION_PLAN.md)), generate a strict JSON-schema:

**`contract-tests/schemas/ask-chunk-event.schema.json`:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "ChunkEvent": {
      "type": "object",
      "properties": {
        "type": { "const": "chunk" },
        "text": { "type": "string" }
      },
      "required": ["type", "text"],
      "additionalProperties": false
    },
    "CitationEvent": {
      "type": "object",
      "properties": {
        "type": { "const": "citation" },
        "title": { "type": "string" },
        "url": { "type": "string", "format": "uri" }
      },
      "required": ["type", "title", "url"],
      "additionalProperties": false
    },
    "DoneEvent": {
      "type": "object",
      "properties": { "type": { "const": "done" } },
      "required": ["type"],
      "additionalProperties": false
    },
    "ErrorEvent": {
      "type": "object",
      "properties": {
        "type": { "const": "error" },
        "code": { "type": "string" },
        "message": { "type": "string" }
      },
      "required": ["type", "code", "message"],
      "additionalProperties": false
    }
  },
  "oneOf": [
    { "$ref": "#/definitions/ChunkEvent" },
    { "$ref": "#/definitions/CitationEvent" },
    { "$ref": "#/definitions/DoneEvent" },
    { "$ref": "#/definitions/ErrorEvent" }
  ]
}
```

---

## Step 2 — Contract validation tests

Generate cross-layer tests that validate captured real streams conform to schemas:

**`contract-tests/contract.spec.js` (frontend, Vitest):**
```javascript
import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from './schemas/ask-chunk-event.schema.json';

const ajv = new Ajv();
const validate = ajv.compile(schema);

describe('SSE contract', () => {
  it('should validate real Chunk event against schema', () => {
    const event = { type: 'chunk', text: 'Hello world' };
    const valid = validate(event);
    expect(valid).toBe(true);
    if (!valid) console.error(validate.errors);
  });

  it('should reject event with missing required field', () => {
    const event = { type: 'chunk' }; // missing 'text'
    const valid = validate(event);
    expect(valid).toBe(false);
  });

  it('should reject event with extra fields', () => {
    const event = { type: 'chunk', text: 'Hi', extra: 'field' };
    const valid = validate(event);
    expect(valid).toBe(false);
  });

  it('should validate Citation event', () => {
    const event = {
      type: 'citation',
      title: 'Manual v2',
      url: 'https://example.com/manual'
    };
    expect(validate(event)).toBe(true);
  });
});
```

**`contract-tests/contract.kt` (backend, JUnit 5):**
```kotlin
// backend/src/test/kotlin/.../contract/SseContractTest.kt
@Test
fun `Chunk event matches schema`() {
  val chunk = AskChunk.Chunk("Hello")
  val json = ObjectMapper().writeValueAsString(chunk)
  val parsed = ObjectMapper().readTree(json)
  assertThat(parsed["type"].asText()).isEqualTo("chunk")
  assertThat(parsed["text"].asText()).isNotEmpty()
}
```

---

## Step 3 — Mock orchestrator for offline dev

Many developers may not have the RAG orchestrator running locally. Generate a **fallback mock**:

**`backend/src/main/kotlin/.../mock/MockOrchestratorClient.kt`:**
```kotlin
@Component
@ConditionalOnProperty(
  name = "orchestrator.mock-enabled",
  havingValue = "true"
)
class MockOrchestratorClient(
  val properties: OrchestratorProperties
) : OrchestratorClient {

  override fun askOrchestrator(
    ask: String,
    conversationId: String,
    userContext: UserContext
  ): Flow<AskChunk> = flow {
    // Simulate streaming response
    emit(AskChunk.Chunk("This is a mocked response to: \"$ask\""))
    delay(100)
    emit(AskChunk.Citation("Sample Doc", "https://example.com/doc"))
    emit(AskChunk.Done())
  }
}
```

**`application-mock.yml`:**
```yaml
orchestrator:
  mock-enabled: true
  url: http://localhost:8080  # ignored when mock is enabled
  api-key: mock-key
```

Print:
```
To develop without the real orchestrator:

./gradlew -p backend bootRun --args='--spring.profiles.active=mock'

The backend will return mocked SSE responses. Perfect for frontend dev.
```

---

## Step 4 — Frontend fallback for auth failures

If MSAL was left as TODO, the frontend's `auth.js|ts` throws on `getToken()`. Generate a **dev fallback**:

**`frontend/src/services/auth-stub.js`:**
```javascript
/**
 * Stub auth for offline dev.
 * When MSAL is ready, replace this with real getToken() from auth.js.
 */
export async function getToken() {
  const devToken = localStorage.getItem('dev-auth-token');
  if (devToken) return devToken;

  // Generate a fake JWT for local testing
  const fakeClaims = {
    oid: 'dev-user-id',
    preferred_username: 'dev@example.com',
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
  };
  const fakeJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(fakeClaims))}.STUB`;
  localStorage.setItem('dev-auth-token', fakeJwt);
  console.warn('⚠️ Using stub JWT for dev. Replace auth.js when MSAL is wired.');
  return fakeJwt;
}
```

And in `ragApi.js`:
```javascript
const token = await getToken().catch(() => {
  console.warn('⚠️ Auth failed. Using stub token for offline dev.');
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.STUB';
});
```

---

## Step 5 — Communication failure scenarios & troubleshooting

Generate **`docs/communication-fallbacks.md`**:

```markdown
# Communication Fallbacks & Troubleshooting

## Offline development

### Scenario: RAG orchestrator is down

**Frontend side:**
- `useSseClient` will timeout after 30s and surface a network error.
- Tests should mock `fetch` to avoid real network calls.

**Backend side:**
- Use `MockOrchestratorClient` by running with `--spring.profiles.active=mock`.
- Alternatively, set `orchestrator.mock-enabled=true` in `application.yml`.

**To test locally (frontend + backend, no orchestrator):**

\`\`\`bash
# Terminal 1: Backend (mocked orchestrator)
cd backend
./gradlew bootRun --args='--spring.profiles.active=dev,mock'

# Terminal 2: Frontend
cd frontend
pnpm dev
\`\`\`

Visit `http://localhost:5173`, submit a query. Backend returns fake SSE, frontend renders it.

### Scenario: MSAL auth is not wired

**Frontend:**
- `auth.{js|ts}::getToken()` throws.
- `ragApi.js` catches the error and uses a stub JWT (`dev-auth-token` from localStorage).
- Log appears: "⚠️ Using stub JWT for offline dev."

**To wire real auth later:**
- Implement `src/services/auth.js|ts` with real MSAL calls.
- Import it in `ragApi.js` instead of the stub.
- Test with real Azure AD tenant.

### Scenario: Backend can't reach orchestrator (network error)

**Behavior:**
- `RagController` gets a 502 / timeout from `OrchestratorClient`.
- `SseEnvelopeMapper` catches the error and emits an `ErrorEvent`.
- Frontend receives `{type:"error", code:"UPSTREAM_TIMEOUT", message:"..."}`.
- UI shows error banner.

**To debug:**
\`\`\`bash
# Check if orchestrator is reachable
curl -X POST http://<orchestrator-host>:8080/orchestrator \
  -H "X-API-KEY: <key>" \
  -H "Content-Type: application/json" \
  -d '{"ask":"test"}'

# Check backend logs
./gradlew -p backend bootRun -i | grep -A5 OrchestratorClient
\`\`\`

### Scenario: JWT is expired

**Behavior:**
- Backend's JWT filter rejects the token with 401 Unauthorized.
- Frontend's `useSseClient` sees 401 and emits an error.
- UI prompts user to re-authenticate.

**To test:**
- Set MSAL token expiry to -1 (already expired).
- Or use a known-bad token in curl.

### Scenario: CORS preflight fails

**Symptom:**
- Browser console shows "Access-Control-Allow-Origin missing."
- `useSseClient` aborts before SSE connection.

**Root cause:**
- Backend's CORS config missing or incorrect.

**To fix:**
- Check `SecurityConfig.kt` has CORS configured for your frontend origin.
- If dev/prod mismatch, add to `application-dev.yml`:
\`\`\`yaml
spring:
  web:
    cors:
      allowed-origins: http://localhost:5173
      allowed-methods: GET,POST,OPTIONS
\`\`\`

---

## Testing without a backend

(If testing only frontend in isolation, e.g., Storybook or component testing)

### Mock useSseClient

**Example (Vitest):**
\`\`\`javascript
import { describe, it, expect, vi } from 'vitest';
import RagChat from '@/components/rag/RagChat.vue';

describe('RagChat (mocked SSE)', () => {
  it('should render incoming chunks', async () => {
    const mockSse = vi.fn(async function* (url, options) {
      yield { type: 'chunk', text: 'Mocked chunk' };
      yield { type: 'done' };
    });

    vi.mock('@microsoft/fetch-event-source', () => ({
      fetchEventSource: mockSse
    }));

    // Mount component and test rendering
    const { getByText } = render(RagChat);
    expect(getByText('Mocked chunk')).toBeInTheDocument();
  });
});
\`\`\`

---

## Testing without a frontend

(If testing only backend, e.g., controller unit tests)

### Mock OrchestratorClient

Already done in `SseEnvelopeMapper.spec.kt` and `RagController.spec.kt` using MockK:

\`\`\`kotlin
@Test
fun `RagController streams normalized events`() {
  val mockOrchestrator = mockk<OrchestratorClient>()
  coEvery { mockOrchestrator.ask(...) } returns flowOf(
    AskChunk.Chunk("Hello"),
    AskChunk.Done()
  )

  val controller = RagController(mockOrchestrator, ...)
  val response = controller.ask(AskRequest("test"), jwt)
  // Assert SSE output
}
\`\`\`

---

## CI/CD considerations

- **Frontend tests:** Should never call real backend. Use `@microsoft/fetch-event-source` mocks.
- **Backend tests:** Should use `MockWebServer` for orchestrator, `@WebFluxTest` for controllers.
- **Contract tests:** Should run in CI to catch frontend ↔ backend drift.
- **E2E tests (Playwright, if opted in):** Should point to a test instance (mock orchestrator enabled).

---

## Recovery procedures

| Issue | Recovery |
|---|---|
| Token expired mid-request | Catch 401, redirect to login, retry |
| Orchestrator timeout (30s) | Log & emit error, user can retry |
| CORS error | Check CORS config, reload frontend |
| Backend crash | Frontend should timeout & show error banner |
| Frontend crash | Backend continues streaming (client disconnect) |
```

---

## Step 6 — Contract test execution

Run both frontend and backend contract tests:

```bash
# Frontend
cd frontend && pnpm test contract.spec.js

# Backend
cd backend && ./gradlew -p backend test -k ContractTest
```

Print results:
```
✅ Contract validation complete

Frontend contract tests: 8/8 passed
Backend contract tests: 8/8 passed
Schema compliance: 100%

All SSE events match the defined schema.
Frontend ↔ Backend communication is safe.
```

---

## Step 7 — Update SCAFFOLD_PROGRESS.md

```markdown
## Phase 04 — Contract-Tests ✅ DONE

**Completed:** <timestamp>

**Contracts:**
- `contract-tests/schemas/ask-chunk-event.schema.json` ✅
- Frontend contract tests: 8/8 passed ✅
- Backend contract tests: 8/8 passed ✅

**Fallbacks/Mocks:**
- Mock orchestrator (Spring `@ConditionalOnProperty`) ✅
- Frontend auth stub (localStorage fallback) ✅
- Docs: `docs/communication-fallbacks.md` ✅

**Coverage:**
- Network error scenarios documented ✅
- CORS troubleshooting documented ✅
- Auth failure recovery documented ✅
- Offline dev flow documented ✅

**Next phase:** 05-Docs-Generation
```

---

## Guardrails

- **Schemas are the source of truth.** If frontend or backend deviates from the schema, fail the contract test loudly.
- **Mock should be easy to toggle.** `@ConditionalOnProperty` or env var, not hardcoded.
- **Mocks are for dev, not prod.** Never ship mocks enabled. CI must validate against real orchestrator stub or testcontainers.
- **Stub tokens should be clearly marked.** Log "⚠️ STUB" to make it obvious.
