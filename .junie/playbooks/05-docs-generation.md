# Playbook: 05 — Comprehensive Documentation & Guides

**Purpose:** Generate fool-proof docs for anyone to onboard, understand, modify, and fix this system. No prior context required.

**Input:** `SCAFFOLD_DECISIONS.md`, completed `frontend/` + `backend/` + `contract-tests/`, [INTEGRATION_PLAN.md](../../INTEGRATION_PLAN.md).

**Output:** Complete `docs/` folder with architecture, API refs, setup guides, troubleshooting, naming conventions, testing conventions, repo structure explained.

---

## Generated documentation

### 1. `docs/README.md` — Main entry point

```markdown
# GPT-RAG App — Complete Guide

Welcome. This guide covers:
- What this project does
- How to set it up
- How to run it
- How to test it
- How to modify it
- How to fix problems

No prior knowledge needed. If something is unclear, file an issue.

## TL;DR

\`\`\`bash
# 1. Install
pnpm install
cd backend && ./gradlew build && cd ..

# 2. Run (dev, with mock orchestrator)
# Terminal 1: Backend
cd backend && ./gradlew bootRun --args='--spring.profiles.active=dev,mock'

# Terminal 2: Frontend
cd frontend && pnpm dev

# 3. Open browser
open http://localhost:5173
\`\`\`

---

[Full table of contents below, covering Setup, Architecture, Development, Testing, Troubleshooting, Naming Conventions, etc.]
```

### 2. `docs/ARCHITECTURE.md` — System design explained

```markdown
# Architecture & Design

## High-level flow

1. User opens app (Vue 3 frontend).
2. Clicks "Ask RAG" → sends query to Spring Boot backend.
3. Backend proxies request to Python FastAPI orchestrator.
4. Orchestrator retrieves context (via AI Search), generates answer (via Azure OpenAI).
5. Backend normalizes the response (SSE → JSON envelope) and streams back to frontend.
6. Frontend renders: text chunks, citations, error states.

## Directory structure explained

\`\`\`
.
├── INTEGRATION_PLAN.md           ← Authoritative design document
├── SCAFFOLD_DECISIONS.md         ← Your build-time choices (read-only)
├── SCAFFOLD_PROGRESS.md          ← Live status of the scaffolding
├── README.md                     ← Getting started
├── frontend/
│   ├── src/
│   │   ├── services/ragApi.js    ← HTTP client (calls POST /api/rag/ask)
│   │   ├── composables/
│   │   │   ├── useRagChat.js     ← Chat state (messages, streaming flag)
│   │   │   └── useSseClient.js   ← SSE parser (low-level event handling)
│   │   ├── components/rag/       ← Vue components (Chat, Message, Citation, Input)
│   │   ├── plugins/markdown.js   ← Markdown rendering + XSS sanitization
│   │   └── services/auth.js      ← JWT token fetching (MSAL or stub)
│   └── package.json              ← Dependencies
├── backend/
│   ├── src/main/kotlin/com/.../rag/
│   │   ├── RagApplication.kt     ← Entry point
│   │   ├── config/               ← Security, WebClient, properties
│   │   ├── web/                  ← Controllers (REST endpoints)
│   │   ├── service/              ← Business logic (SSE mapping, auth, orchestrator client)
│   │   └── tools/                ← Tool registry (extensible for future tools)
│   ├── build.gradle.kts          ← Dependencies
│   └── src/test/kotlin/          ← Tests (JUnit 5 + MockK)
├── contract-tests/               ← Cross-layer validation (JSON schemas)
└── docs/
    ├── README.md                 ← This file
    ├── ARCHITECTURE.md           ← You are here
    ├── SETUP.md                  ← Prerequisites & installation
    ├── API-REFERENCE.md          ← Frontend & backend APIs
    ├── DEVELOPMENT.md            ← How to modify code
    ├── TESTING.md                ← Testing philosophy & how-tos
    ├── TROUBLESHOOTING.md        ← Common issues & fixes
    ├── NAMING-CONVENTIONS.md     ← Coding standards for this project
    ├── COMMUNICATION-FALLBACKS.md ← Offline dev, mocks, error scenarios
    ├── frontend-api.md           ← Auto-generated (from frontend code)
    ├── backend-openapi.md        ← Auto-generated (from backend code)
    └── schemas/                  ← JSON-schema contracts (SSE events)

## Technology stack

| Layer | Tech | Why |
|---|---|---|
| Frontend | Vue 3 + Vuetify | Rapid UI, Material Design |
| Frontend state | Pinia | Simple, Vue-native reactivity |
| Frontend HTTP | `@microsoft/fetch-event-source` | Custom headers + SSE (native EventSource can't send auth) |
| Frontend testing | Vitest + @vue/test-utils | Fast, Vue-integrated |
| Backend | Kotlin + Spring Boot | Type-safe, enterprise-grade, reactive |
| Backend HTTP | WebClient (Reactor) | Non-blocking SSE streaming |
| Backend security | Spring Security OAuth2 Resource Server | JWT validation, Entra ID integration |
| Backend testing | JUnit 5 + MockK | Modern, Kotlin-idiomatic |
| RAG orchestrator | Python FastAPI | Separate, not embedded |
| Data store | Cosmos DB, AI Search, Blob Storage | All on Azure |

## Key design decisions

### SSE (Server-Sent Events)

Why SSE instead of WebSocket?
- Simpler protocol for one-way server → client streaming.
- Works with existing reverse proxies / load balancers.
- Built-in reconnection & event-id support.

### Proxy pattern (Spring Boot in the middle)

Why not call orchestrator from Vue directly?
- CORS — FastAPI would need open CORS policy (security risk).
- Auth translation — JWT from Vue (Entra ID) ≠ auth method orchestrator expects.
- Normalization — raw SSE text is hard to parse on frontend; proxy wraps it as JSON.
- Tools — backend can invoke tools (future phase) on behalf of frontend.

### No embedded orchestrator

Why separate?
- Decoupling — orchestrator can be updated independently.
- Scaling — orchestrator scales separately from UI.
- Multitenant — same orchestrator can serve multiple UIs.

### TDD everywhere

Why?
- Catch bugs early (test-first means you think through behavior before coding).
- Regression prevention — changes are validated by tests.
- Documentation — tests are the clearest spec of how code should behave.

---

## Integration with Azure

- **Azure Entra ID** — JWT tokens for users, OAuth2 token exchange.
- **Azure OpenAI** — LLM (gpt-4o) for chat generation.
- **Azure AI Search** — Hybrid search (vector + keyword) for document retrieval.
- **Azure Cosmos DB** — Conversation history.
- **Azure App Configuration** — Centralized config (versionable, auditable).
- **Azure Key Vault** — Secrets (API keys, connection strings).

All accessed via Managed Identity (no secrets in code).
```

### 3. `docs/SETUP.md` — Installation & environment

```markdown
# Setup & Installation

## Prerequisites

### For frontend development
- Node.js 20+ (check: `node --version`)
- pnpm 9+ (or npm/yarn if you prefer)
- A text editor (VS Code recommended)

### For backend development
- JDK 21+ (check: `java -version`)
- Docker (optional, needed only if you want Testcontainers integration tests)

### For the full system (with real orchestrator)
- Azure account with:
  - Azure OpenAI (gpt-4o model deployed)
  - Azure AI Search (index pre-populated)
  - Cosmos DB (conversation storage)
  - Entra ID (app registrations for SPA + API)

If you don't have an orchestrator, use the mocked version (see below).

---

## Installation (5 minutes)

### 1. Clone and install dependencies

\`\`\`bash
git clone <repo-url>
cd <repo>

# Frontend
cd frontend && pnpm install && cd ..

# Backend
cd backend && ./gradlew build && cd ..
\`\`\`

### 2. Environment setup

Create `.env.local` at repo root:

\`\`\`bash
# VITE_RAG_API_URL=http://localhost:8080  # default: optional to override

# If MSAL is wired (frontend):
# VITE_MSAL_CLIENT_ID=<your-spa-client-id>
# VITE_MSAL_TENANT_ID=<your-tenant-id>
# VITE_MSAL_API_SCOPE=<your-api-scope>

# If using real orchestrator (backend):
# ORCHESTRATOR_URL=https://<your-orchestrator-host>:8080
# ORCHESTRATOR_API_KEY=<shared-secret>
\`\`\`

### 3. Run locally (mocked mode, no orchestrator needed)

**Terminal 1 — Backend:**
\`\`\`bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=dev,mock'
\`\`\`

**Terminal 2 — Frontend:**
\`\`\`bash
cd frontend
pnpm dev
\`\`\`

Open browser: `http://localhost:5173`

You should see the chat UI. Try submitting a query — it returns a mock response.

### 4. Run tests

\`\`\`bash
# Frontend unit tests
cd frontend && pnpm test

# Backend unit tests
cd backend && ./gradlew test

# Contract tests (both layers)
cd contract-tests && pnpm test
\`\`\`

Expected: **All green**.

---

## Configuring with real orchestrator

(If you have an orchestrator running)

Set in `backend/application-dev.yml`:

\`\`\`yaml
orchestrator:
  mock-enabled: false  # disable mock
  url: http://localhost:8080  # or your remote URL
  api-key: <shared-secret>
\`\`\`

Or via env vars:

\`\`\`bash
export ORCHESTRATOR_URL=http://localhost:8080
export ORCHESTRATOR_API_KEY=<key>
./gradlew -p backend bootRun --args='--spring.profiles.active=dev'
\`\`\`

---

## Configuring MSAL auth (frontend)

If MSAL was scaffolded (not left as TODO), configure:

1. Create app registration in Azure Entra ID (SPA type).
2. Get: Client ID, Tenant ID.
3. Create app registration for backend (API type), expose scope.
4. Get: Scope URI.
5. Set env vars:
   \`\`\`bash
   export VITE_MSAL_CLIENT_ID=<client-id>
   export VITE_MSAL_TENANT_ID=<tenant-id>
   export VITE_MSAL_API_SCOPE=<scope>
   \`\`\`
6. Restart frontend: `pnpm dev`.

For offline dev without MSAL, the frontend falls back to a stub JWT (see COMMUNICATION-FALLBACKS.md).

---

## IDE setup (recommended)

### VS Code (frontend)

Install extensions:
- Vetur (Vue language support)
- Prettier (code formatting)
- ESLint (linting)

Open `frontend/` as root folder. Reload window.

### IntelliJ IDEA (backend)

Open project root. IntelliJ auto-detects `build.gradle.kts`.

Settings → Languages & Frameworks → Kotlin → Compiler: set target JVM 21.

---

## Troubleshooting setup

| Issue | Fix |
|---|---|
| `pnpm: command not found` | Install: `npm install -g pnpm` |
| `./gradlew: permission denied` | Run: `chmod +x gradlew` |
| Port 5173 (frontend) already in use | Specify: `pnpm dev -- --port 3000` |
| Port 8080 (backend) already in use | Specify: `./gradlew bootRun -P args='--server.port=8081'` |
| Docker not running (Testcontainers) | Start Docker. Or skip integration tests: `./gradlew test -x integrationTest` |

(Continue with more troubleshooting...)
```

### 4. `docs/DEVELOPMENT.md` — How to make changes

```markdown
# Development Guide

## Adding a new feature

### Example: Add a "Clear chat" button

1. **Write the test first** (TDD):

\`\`\`javascript
// frontend/src/composables/useRagChat.spec.js
it('should clear all messages on clearChat()', () => {
  const { messages, clearChat } = useRagChat();
  messages.value = [{ role: 'user', content: 'Hi' }];
  
  clearChat();
  
  expect(messages.value).toEqual([]);
});
\`\`\`

2. **See it fail:**
   \`\`\`bash
   cd frontend && pnpm test useRagChat.spec.js
   # Test fails: "clearChat is not defined"
   \`\`\`

3. **Implement the feature:**

\`\`\`javascript
// frontend/src/composables/useRagChat.js
export function useRagChat() {
  const messages = ref([]);
  
  const clearChat = () => {
    messages.value = [];
    currentConversationId.value = null;
  };
  
  return { messages, clearChat, ... };
}
\`\`\`

4. **See it pass:**
   \`\`\`bash
   cd frontend && pnpm test useRagChat.spec.js
   # ✅ All tests pass
   \`\`\`

5. **Commit:**
   \`\`\`bash
   git add frontend/src/composables/useRagChat.*
   git commit -m "feat(rag-chat): add clearChat() method — TDD green"
   \`\`\`

6. **Wire into component:**

\`\`\`vue
<!-- frontend/src/components/rag/RagChat.vue -->
<template>
  <button @click="clearChat">Clear</button>
  ...
</template>

<script setup>
const { clearChat } = useRagChat();
</script>
\`\`\`

7. **Test the component:**
   \`\`\`bash
   cd frontend && pnpm test RagChat.spec.js
   # Assert button click calls clearChat
   \`\`\`

### Naming conventions (from REFERENCE_BRIEF / defaults)

- **Components:** PascalCase (RagChat.vue, not rag-chat.vue)
- **Composables:** camelCase with `use` prefix (useRagChat, not RagChat)
- **Props:** camelCase (askText, not ask_text)
- **Events:** camelCase (submit, not @Submit)
- **CSS classes:** kebab-case (.rag-message, not .ragMessage)

---

## Adding a backend tool

### Example: Add a "create ticket" tool

1. **Write the test:**

\`\`\`kotlin
// backend/src/test/kotlin/.../tools/CreateTicketToolTest.kt
@Test
fun \`should validate required parameters\`() {
  val tool = CreateTicketTool()
  val params = CreateTicketTool.Params(title = "", description = "")
  
  val result = assertThrows<InvalidParameterException> {
    tool.execute(params, userContext)
  }
  
  expect(result.message).toContain("title must not be empty")
}
\`\`\`

2. **Implement:**

\`\`\`kotlin
// backend/src/main/kotlin/.../tools/CreateTicketTool.kt
class CreateTicketTool : Tool {
  data class Params(
    @field:NotBlank(message = "title must not be empty")
    val title: String,
    val description: String
  )
  
  override fun execute(params: Params, userContext: UserContext): ToolResult {
    // Call external API, database, etc.
    return ToolResult("Ticket-123", mapOf("status" to "created"))
  }
}
\`\`\`

3. **Register in ToolRegistry:**

\`\`\`kotlin
// backend/src/main/kotlin/.../tools/ToolRegistry.kt
init {
  register(
    name = "createTicket",
    description = "Create a support ticket",
    tool = CreateTicketTool(),
    params = listOf(
      Parameter("title", "string", "Ticket title", required = true),
      Parameter("description", "string", "Details", required = false)
    )
  )
}
\`\`\`

4. **Test integration:**

\`\`\`bash
cd backend && ./gradlew test -k ToolRegistry
\`\`\`

---

## Refactoring a composable

Always keep tests green:

\`\`\`bash
cd frontend

# Before touching code
pnpm test useRagChat.spec.js
# ✅ All pass

# Edit useRagChat.js (refactor internals, keep interface same)

# After editing
pnpm test useRagChat.spec.js
# ✅ All still pass

# Commit
git commit -m "refactor(rag-chat): simplify state initialization — tests green"
\`\`\`

---

## When to ask for help

- If a test fails and you don't know why → check TROUBLESHOOTING.md
- If the system behaves unexpectedly → enable debug logging (see below)
- If you're unsure about naming → check NAMING-CONVENTIONS.md
- If you're unsure about testing → check TESTING.md

## Debug mode

### Frontend

\`\`\`javascript
// In browser console
localStorage.setItem('DEBUG', 'rag:*');
location.reload();
// Now see detailed logs
\`\`\`

### Backend

\`\`\`bash
./gradlew bootRun --args='--logging.level.com.example.rag=DEBUG'
\`\`\`

---

## Code review checklist

Before pushing:

- [ ] Tests pass locally (`pnpm test` / `./gradlew test`)
- [ ] Tests are green (not skipped)
- [ ] Naming follows conventions (NAMING-CONVENTIONS.md)
- [ ] No hardcoded secrets or credentials
- [ ] No console.log or println in production code (okay in tests)
- [ ] Commit message is descriptive
```

### 5. `docs/TESTING.md` — Testing philosophy & practices

```markdown
# Testing Guide

## Philosophy

**TDD is not optional.** Every feature starts with a failing test.

Why?
- Forces you to think about behavior before implementation.
- Catches bugs early (when they're cheapest to fix).
- Documents expected behavior (tests are specs).
- Prevents regressions (future changes validated by tests).

## Principles

1. **Test behavior, not implementation.** Don't assert on internal state; assert on what users see.
2. **Name tests clearly.** Test name = spec. Example: `should disable submit button while streaming`.
3. **One assertion per test (when possible).** Makes failures easy to debug.
4. **Keep tests fast.** Unit tests < 100ms. Integration tests < 1s.
5. **Use mocks/stubs for external dependencies.** Tests should never call real APIs.

## Frontend testing (Vitest + @vue/test-utils)

### Unit test template

\`\`\`javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import RagInput from '@/components/rag/RagInput.vue';

describe('RagInput.vue', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = mount(RagInput);
  });

  it('should emit submit event on Enter key', async () => {
    const input = wrapper.find('textarea');
    await input.setValue('Hello');
    await input.trigger('keydown', { key: 'Enter', ctrlKey: false });

    expect(wrapper.emitted('submit')).toBeTruthy();
    expect(wrapper.emitted('submit')[0]).toEqual(['Hello']);
  });

  it('should not emit on Shift+Enter', async () => {
    const input = wrapper.find('textarea');
    await input.trigger('keydown', { key: 'Enter', shiftKey: true });

    expect(wrapper.emitted('submit')).toBeFalsy();
  });

  it('should disable submit button while streaming', async () => {
    await wrapper.setProps({ isStreaming: true });
    expect(wrapper.find('button').attributes('disabled')).toBeDefined();
  });
});
\`\`\`

### Component test patterns

**Async operations:**

\`\`\`javascript
it('should render response when ask() completes', async () => {
  const { ask } = useRagChat();
  
  // Trigger the async operation
  const promise = ask('What is X?');
  
  // Let it settle
  await flushPromises();
  
  // Assert result
  expect(messages.value[0].content).toBe('The answer...');
});
\`\`\`

**SSE mocking:**

\`\`\`javascript
import { vi } from 'vitest';

it('should handle SSE stream', async () => {
  const mockStream = [
    { type: 'chunk', text: 'Hello' },
    { type: 'citation', title: 'Doc', url: 'https://...' },
    { type: 'done' }
  ];
  
  vi.mock('@microsoft/fetch-event-source', () => ({
    fetchEventSource: vi.fn(async (url, { onmessage }) => {
      mockStream.forEach(event => onmessage({ data: JSON.stringify(event) }));
    })
  }));
  
  // Test
});
\`\`\`

---

## Backend testing (JUnit 5 + MockK)

### Unit test template

\`\`\`kotlin
import io.mockk.mockk
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class RagControllerTest {
  
  @Test
  fun \`should stream SSE events on ask\`() {
    val orchestratorClient = mockk<OrchestratorClient>()
    coEvery { orchestratorClient.ask(...) } returns flowOf(
      AskChunk.Chunk("Hello"),
      AskChunk.Done()
    )
    
    val controller = RagController(orchestratorClient, ...)
    val events = controller.ask(AskRequest("test"), "Bearer token").toList()
    
    assertTrue(events[0] is AskChunk.Chunk)
    assertEquals("Hello", (events[0] as AskChunk.Chunk).text)
  }
  
  @Test
  fun \`should return 401 for invalid JWT\`() {
    // MockJwt.jwt().principal("").build() — simulate invalid token
    // Assert 401 response
  }
}
\`\`\`

### Integration test (with Testcontainers)

\`\`\`kotlin
@SpringBootTest(webEnvironment = RANDOM_PORT)
@Testcontainers
class RagControllerIntegrationTest {
  
  @Container
  companion object {
    val postgres = PostgreSQLContainer<Nothing>("postgres:15")
  }
  
  @Test
  fun \`should create conversation and persist to database\`(
    @Autowired webClient: WebTestClient
  ) {
    // Setup: insert test data into containerized DB
    
    val response = webClient
      .post()
      .uri("/api/rag/ask")
      .header("Authorization", "Bearer <valid-jwt>")
      .bodyValue(AskRequest("test", ...))
      .exchange()
    
    response.expectStatus().isOk
    
    // Verify conversation was persisted
    val saved = conversationRepository.findById(...).block()
    assertNotNull(saved)
  }
}
\`\`\`

---

## Running tests

### Frontend

\`\`\`bash
cd frontend

# Run all tests
pnpm test

# Run specific test file
pnpm test RagChat.spec.js

# Watch mode (re-run on file change)
pnpm test --watch

# Coverage report
pnpm test --coverage
\`\`\`

### Backend

\`\`\`bash
cd backend

# Run all tests
./gradlew test

# Run specific test class
./gradlew test --tests RagControllerTest

# Skip slow integration tests
./gradlew test -x integrationTest

# Coverage report
./gradlew jacocoTestReport
\`\`\`

### Contract tests (cross-layer)

\`\`\`bash
cd contract-tests
pnpm test
# Validates frontend ↔ backend SSE event compliance
\`\`\`

---

## Continuous Integration

GitHub Actions (or similar) should run on every PR:

\`\`\`yaml
# .github/workflows/ci.yml
- name: Frontend tests
  run: cd frontend && pnpm test --run

- name: Backend tests
  run: cd backend && ./gradlew test

- name: Contract tests
  run: cd contract-tests && pnpm test
\`\`\`

All tests **must pass** before merge.

---

## Common test issues

| Issue | Solution |
|---|---|
| Test timeout | Increase timeout: `it('...', { timeout: 5000 }, async () => {})` |
| `vi.mock` not working | Ensure import path matches exactly |
| JWT claims not found | Use `MockJwt.jwt().claim("oid", "user-id").build()` |
| Testcontainers slow | Run only in CI, skip locally with `@Tag("integration")` and `pnpm test --grep -v integration` |

---

## Test checklist

Before marking a feature done:

- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] No skipped tests (`it.skip`, `xit`)
- [ ] Test names describe behavior
- [ ] Coverage > 80% for new code
```

Plus 2–3 more focused docs:

### 6. `docs/NAMING-CONVENTIONS.md`
```markdown
# Naming Conventions

Adopted from [REFERENCE_BRIEF.md](../REFERENCE_BRIEF.md) <or defaults if not available>.

## Variables & constants

- **Local variables:** camelCase (`messageCount`, `isStreaming`)
- **Constants:** UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT`, `ORCHESTRATOR_URL`)
- **Private/internal:** prefix with `_` or `#` if language supports (JS `#field`)

## Functions & methods

- **Functions:** camelCase (`askOrchestrator`, `parseStreamEvent`)
- **Async functions:** same, but name suggests async (`fetchToken`, `loadMessages`)
- **Predicates:** start with `is` / `has` (`isStreaming`, `hasError`)

## Classes & types

- **Classes:** PascalCase (`RagChat`, `OrchestratorClient`)
- **Interfaces/Traits:** PascalCase (`Tool`, `UserContext`)
- **Enums:** PascalCase values (`PENDING`, `STREAMING`, `DONE`)

## Files & folders

- **Components:** PascalCase (`RagChat.vue`, not rag-chat.vue)
- **Composables:** camelCase with `use` prefix (`useRagChat.js`)
- **Services:** camelCase (`ragApi.js`, `authService.js`)
- **DTOs:** PascalCase + suffix (`AskRequest`, `AskResponse`)
- **Tests:** append `.spec.js` / `.test.kt` (`RagChat.spec.js`)
- **Folders:** kebab-case / lowercase (`src/components`, `src/services`)

## Props, events, attributes

- **Props:** camelCase (`askText`, `isLoading`)
- **Events:** camelCase, verb-based (`@submit`, `@error`, not `@on-submit`)
- **CSS classes:** kebab-case (`.rag-message`, `.is-streaming`)

## Database / API

- **Tables:** snake_case (`conversations`, `user_messages`)
- **Columns:** snake_case (`conversation_id`, `created_at`)
- **Endpoints:** kebab-case or snake_case (`/api/rag/ask`, `/api/tools/create-ticket`)

## Git commits

- **Format:** `<type>(<scope>): <message>`
- **Type:** feat, fix, refactor, test, docs, chore, perf
- **Scope:** rag-fe (frontend), rag-be (backend), infra
- **Message:** present tense, descriptive
  - ✅ `feat(rag-fe): add clear chat button — TDD green`
  - ❌ `added button`

---

## Why these conventions?

- **Consistency:** makes code predictable and scannable
- **Readability:** names clearly signal intent and type
- **Tooling:** many linters / formatters enforce these patterns
- **Team:** everyone uses the same style, fewer style debates in code review
```

### 7. `docs/TROUBLESHOOTING.md` — Common issues & fixes

(Already partially covered in COMMUNICATION-FALLBACKS.md, but expand here with more edge cases.)

---

## Step 2 — Generate these docs

Junie should scaffold all 7+ files with placeholder sections filled in. Print progress:

```
Generating comprehensive documentation...

✅ docs/README.md (main entry point)
✅ docs/ARCHITECTURE.md (design & structure)
✅ docs/SETUP.md (installation & config)
✅ docs/DEVELOPMENT.md (how to modify code)
✅ docs/TESTING.md (testing philosophy)
✅ docs/NAMING-CONVENTIONS.md (coding standards)
✅ docs/TROUBLESHOOTING.md (common issues)

All docs are cross-linked. Start with docs/README.md.
```

---

## Step 3 — Integration guide

Also generate `docs/INTEGRATION-WITH-ORCHESTRATOR.md`:

```markdown
# Integrating with the real RAG orchestrator

By default, the scaffold runs with a **mocked orchestrator** (returns fake SSE).

To switch to the **real orchestrator** (Python FastAPI):

1. Ensure orchestrator is running (docker, k8s, local, etc.)
2. Get: endpoint URL, API key
3. Update `backend/application.yml`:
   \`\`\`yaml
   orchestrator:
     mock-enabled: false
     url: https://your-orchestrator.azurecontainers.io
     api-key: <shared-secret>
   \`\`\`
4. Restart backend: `./gradlew bootRun --args='--spring.profiles.active=dev'`
5. Test: submit a query in the frontend UI

If it fails, check TROUBLESHOOTING.md → "Backend can't reach orchestrator".

---

## Authentication (OBO flow)

The backend uses **On-Behalf-Of** (OBO) to convert user's JWT to orchestrator credentials.

See [INTEGRATION_PLAN.md §8](../../INTEGRATION_PLAN.md) for Entra ID setup.

\`\`\`
```

---

## Step 4 — Repo structure guide

Generate `docs/REPO-STRUCTURE.md` (quick ref):

```markdown
# Repository Structure (Quick Reference)

| Path | Purpose |
|---|---|
| `INTEGRATION_PLAN.md` | Authoritative system design (read first) |
| `SCAFFOLD_DECISIONS.md` | Your scaffolding choices (read-only) |
| `README.md` | Getting started (you are here) |
| `frontend/` | Vue 3 + Vite app |
| `backend/` | Kotlin + Spring Boot API |
| `contract-tests/` | Cross-layer validation schemas |
| `docs/` | Everything else (guides, API refs, troubleshooting) |
| `.junie/` | Junie playbooks (for onboarding / re-scaffolding) |
```

---

## Step 5 — Update main README

Ensure top-level `README.md` points to `docs/README.md` for the full guide:

```markdown
# GPT-RAG App

A Vue 3 + Spring Boot app that embeds the GPT-RAG orchestrator.

**Start here:** [docs/README.md](docs/README.md) (complete guide).

**Quick start:**
\`\`\`bash
cd backend && ./gradlew bootRun --args='--spring.profiles.active=dev,mock' &
cd frontend && pnpm dev
# Open http://localhost:5173
\`\`\`

For architecture, setup, development, testing, and troubleshooting, see [docs/README.md](docs/README.md).
```

---

## Step 6 — Update SCAFFOLD_PROGRESS.md with final status

```markdown
## Phase 05 — Docs-Generation ✅ DONE

**Completed:** <timestamp>

**Documentation generated:**
- docs/README.md (main entry point, 100+ lines)
- docs/ARCHITECTURE.md (system design, 200+ lines)
- docs/SETUP.md (installation & config, 150+ lines)
- docs/DEVELOPMENT.md (how to modify, 200+ lines)
- docs/TESTING.md (testing philosophy, 250+ lines)
- docs/NAMING-CONVENTIONS.md (coding standards, 80+ lines)
- docs/TROUBLESHOOTING.md (common issues, 150+ lines)
- docs/INTEGRATION-WITH-ORCHESTRATOR.md (OBO flow, 50+ lines)
- docs/REPO-STRUCTURE.md (quick ref, 20+ lines)
- docs/COMMUNICATION-FALLBACKS.md (mocks & error scenarios, 150+ lines)

**Total lines of docs:** 1200+

**Coverage:**
- Setup & installation: ✅
- Architecture & design: ✅
- API reference (auto-extracted from code): ✅
- Development practices: ✅
- Testing philosophy & practices: ✅
- Naming conventions: ✅
- Troubleshooting: ✅
- Offline dev & mocks: ✅
- Recovery procedures: ✅

**Audience:** Anyone with zero prior context can:
- Set up the project (SETUP.md)
- Understand how it works (ARCHITECTURE.md)
- Make changes (DEVELOPMENT.md)
- Write tests (TESTING.md)
- Fix problems (TROUBLESHOOTING.md)

---

## Final Summary

**All phases complete: ✅**

| Phase | Status | Output |
|---|---|---|
| 01-Preflight | ✅ | SCAFFOLD_DECISIONS.md |
| 02-Frontend | ✅ | frontend/, docs/frontend-api.md, 27 tests |
| 03-Backend | ✅ | backend/, docs/backend-openapi.md, 32 tests |
| 04-Contracts | ✅ | contract-tests/, docs/communication-fallbacks.md |
| 05-Docs | ✅ | docs/, 10+ comprehensive guides |

**Total tests:** 59+ all passing
**Code coverage:** 85%+ frontend, 80%+ backend
**Documentation:** 1200+ lines (fool-proof for any developer)

**You can now:**
- [ ] Run the app locally (with mocks, no orchestrator needed)
- [ ] Modify any feature (TDD-first, tests always green)
- [ ] Add new tools (backend extensibility)
- [ ] Debug communication failures (fallbacks documented)
- [ ] Onboard new team members (docs are self-contained)

**Next steps from [INTEGRATION_PLAN.md §8](../../INTEGRATION_PLAN.md):**
- Phase 2 Hardening (rate limiting, resilience, caching)
- Phase 3 Agentic tools (real tool implementations)
- Phase 4 MCP server (optional, for multi-client tool sharing)

**Need help?**
- Read TROUBLESHOOTING.md for common issues
- Check DEVELOPMENT.md for "how to X"
- Review NAMING-CONVENTIONS.md before writing code
- File an issue if docs are unclear or incomplete
```

---

## Guardrails

- **Docs are gospel.** If docs don't match code, code is wrong; update both.
- **Link aggressively.** Every guide should link to related docs and the INTEGRATION_PLAN.md.
- **Assume zero context.** Don't reference "as discussed" or assume background knowledge.
- **Use examples.** Every concept should have a runnable example or code snippet.
- **Keep docs in sync.** When you change code, update the corresponding doc section immediately.
