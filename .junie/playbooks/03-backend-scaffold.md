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
