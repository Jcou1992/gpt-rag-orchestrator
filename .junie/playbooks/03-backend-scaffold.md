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

**Package-root invariant (read first — non-negotiable).** The `@SpringBootApplication` class is `com.example.rag.RagApplication`, so Spring Boot's default component scan starts at `com.example.rag`. Every backend production class in this unit MUST live under `com.example.rag.*` (`com.example.rag.config`, `com.example.rag.dev`, `com.example.rag.security`). Putting a class under `com.example.config` (or any sibling of `com.example.rag`) silently excludes it from the runtime context — the slice tests would still pass against their explicit `withUserConfiguration(...)`, but the deployed app's `SecurityWebFilterChain` and `ReactiveJwtDecoder` beans would be absent and the auth boundary would collapse. `SecurityBeansPresentTest` (Step C) catches this regression at boot time. Test-tree fixtures (e.g., `MockSyntheticDouble` for `DevDoubleClasspathScanTest`) MUST live OUTSIDE `com.example.rag.*` (use `com.fixtures.*`) so the production gate test cannot discover them.

**Why this unit exists.** Frontend hardening (playbook 04 leak test) is decorative without a matching backend gate plus real token validation on the wire. This unit closes both: (a) every dev/test-double bean is property-gated fail-closed, and (b) `oauth2ResourceServer().jwt()` is wired with JWKS URI, audience, and issuer so unsigned/forged tokens are rejected at the boundary. The two integration tests below — `DevDoubleGateTest` and `OboValidationTest` — fail the build whenever either gate regresses.

**Files:**
- `src/main/kotlin/com/example/rag/config/annotations/DevOnlyBean.kt`
- `src/main/kotlin/com/example/rag/config/SecurityConfig.kt` (extend Unit 6 output — WebFlux reactive)
- `src/main/resources/application.yml` (add `app.dev-doubles.enabled` + `app.entra.*` properties)
- `src/test/kotlin/com/example/rag/config/DevDoubleGateTest.kt` (Spring slice — gating-misfire layer)
- `src/test/kotlin/com/example/rag/config/DevDoubleClasspathScanTest.kt` (static classpath scan — load-bearing layer)
- `src/test/kotlin/com/fixtures/devdoublescan/MockSyntheticDouble.kt` (test-only fixture proving the scanner pipeline finds dev-double-named classes — regression guard for iteration-2 anchor bug; lives **outside** `com.example.rag` so the production gate test cannot see it)
- `src/test/kotlin/com/example/rag/security/JwtTestKit.kt` (deterministic JWT/JWKS fixture builder)
- `src/test/kotlin/com/example/rag/security/OboValidationTest.kt` (WebFlux + WebTestClient + WireMock)
- `src/test/kotlin/com/example/rag/security/SecurityBeansPresentTest.kt` (boots the real `RagApplication` and asserts `SecurityWebFilterChain` + `ReactiveJwtDecoder` beans are registered — catches scan-root drift if anyone moves config outside `com.example.rag`)
- `src/main/kotlin/com/example/rag/dev/MockOrchestratorClient.kt` (the one dev double — referenced by `DevDoubleGateTest` and `OboValidationTest`; generated in this phase because both tests need it on the classpath when phase 03 runs)

#### Step A — Define the `@DevOnlyBean` meta-annotation (load-bearing primary control)

A single class-level `@ConditionalOnProperty` on a `@Configuration` class does not auto-cascade to its `@Bean` methods unless the methods are individually annotated. To make the property gate cascade uniformly across both top-level `@Component` classes AND `@Bean` methods inside `@Configuration` classes, define `@DevOnlyBean` as a Spring **meta-annotation** that itself carries the `@ConditionalOnProperty`. Anywhere `@DevOnlyBean` is placed — class or method — the property check rides along.

This cascading behavior is why we need a meta-annotation rather than a plain marker. A plain marker would force authors to remember to add `@ConditionalOnProperty` on every site, which is exactly the bypass we are trying to prevent.

**Convention:** every dev/test-double bean class OR `@Bean` method MUST carry `@DevOnlyBean`. The bean-name regex check in `DevDoubleGateTest` (Step C) is defense-in-depth for the case where someone forgets the marker.

```kotlin
// src/main/kotlin/com/example/rag/config/annotations/DevOnlyBean.kt
package com.example.rag.config.annotations

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
// e.g., src/main/kotlin/com/example/rag/dev/MockOrchestratorClient.kt
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

#### Step C — Two-layer dev-double gate test (R7b)

The dev-double gate has two enforcement layers, each implemented as a separate JUnit class. **Both are required** — running only one creates a different vacuous-pass class.

| Test | Surface | Catches |
|---|---|---|
| `DevDoubleGateTest` (Spring slice) | Sliced `ApplicationContextRunner` loaded with the **explicit list** of every dev-double config class in the project | A `@DevOnlyBean`-marked bean registering when `app.dev-doubles.enabled` is unset, and any class name matching the dev-double regex registering through Spring |
| `DevDoubleClasspathScanTest` (static reflection) | The **production classpath**, scanned via `ClassPathScanningCandidateComponentProvider` — independent of any Spring context configuration | Any production class whose simple name matches the dev-double regex AND does not carry `@DevOnlyBean` (catches "ungated dev double exists in source" regardless of whether it gets registered in any test slice) |

**Why two tests.** `ApplicationContextRunner` does NOT component-scan; it only loads explicitly listed `@Configuration` classes (`withUserConfiguration` / `withConfiguration`). If the test slice forgets to include a dev-double config, the slice is incomplete and the assertions pass against an empty context — vacuously. The classpath-scan test catches this case by walking the production classpath at the bytecode level, completely independent of context wiring. **The classpath scan is the load-bearing test; the Spring slice catches gating misfires that only show up at registration time.**

**Bean-name regex (literal, both tests):** `(?i)^(Mock|Stub|Fake|Spy|Dummy|TestDouble|InMemory|Noop)`

**Documented false-positive class.** A class named `MockingjayController` matches this regex. The marker annotation `@DevOnlyBean` is the load-bearing primary control; the regex is defense-in-depth. Legitimate false positives must be either (a) renamed, OR (b) explicitly allow-listed in `DevDoubleClasspathScanTest.ALLOWLIST` (set with a one-line justification per entry). Do not remove the regex check.

##### `DevDoubleGateTest.kt` — Spring slice (gating-misfire catch)

`withUserConfiguration` MUST list every `@Configuration` class that defines or imports dev/test-double beans. The placeholder shown below MUST be replaced by the scaffolded project's actual config class list — the playbook treats this as a required step, NOT optional. Failure to enumerate is failure to test.

```kotlin
// src/test/kotlin/com/example/rag/config/DevDoubleGateTest.kt
package com.example.rag.config

import com.example.rag.config.annotations.DevOnlyBean
// REQUIRED: enumerate every @Configuration class in this project that defines dev-double beans.
// If this project also has @Component-scanned dev doubles (e.g., MockOrchestratorClient),
// import and pass them via .withUserConfiguration(...) too. Missing imports = vacuous pass.
import com.example.rag.dev.DevDoublesConfig                  // contains @DevOnlyBean @Bean methods
import com.example.rag.dev.MockOrchestratorClient            // @DevOnlyBean @Component (playbook 04 Step 3)
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.runner.ApplicationContextRunner

class DevDoubleGateTest {

    private val devDoubleNamePattern =
        Regex("^(Mock|Stub|Fake|Spy|Dummy|TestDouble|InMemory|Noop)", RegexOption.IGNORE_CASE)

    /**
     * Loads every dev-double config class in the project. If you add a new one,
     * append it here — `DevDoubleClasspathScanTest` will fail the build if a new
     * dev-double class exists in the source tree but is missing from this list
     * (its check is independent of this slice).
     */
    private val contextRunner: ApplicationContextRunner = ApplicationContextRunner()
        .withUserConfiguration(
            DevDoublesConfig::class.java,
            MockOrchestratorClient::class.java,
            // ADD MORE: every @Configuration / @Component class that defines or imports
            // a dev/test double belongs in this list.
        )
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

    @Test
    fun `dev-double beans DO register when app dev-doubles enabled is true`() {
        // Positive integration check — with the property set, dev workflows are not regressed.
        contextRunner
            .withPropertyValues("app.dev-doubles.enabled=true")
            .run { context ->
                val markedBeans = context.getBeansWithAnnotation(DevOnlyBean::class.java).keys
                assertThat(markedBeans).isNotEmpty
            }
    }
}
```

##### `DevDoubleClasspathScanTest.kt` — static scan (load-bearing — independent of Spring slicing)

This test walks the production classpath without involving any Spring context. It catches the case where a dev-double class exists in source but was forgotten in the slice. Any class whose simple name matches the regex MUST carry `@DevOnlyBean` OR appear in the allow-list with a justification.

```kotlin
// src/test/kotlin/com/example/rag/config/DevDoubleClasspathScanTest.kt
package com.example.rag.config

import com.example.rag.config.annotations.DevOnlyBean
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider
import org.springframework.core.type.filter.RegexPatternTypeFilter
import org.springframework.util.ClassUtils
import java.util.regex.Pattern

class DevDoubleClasspathScanTest {

    /**
     * Production root package — the scan does NOT walk test-tree classes,
     * since test fixtures may legitimately contain dev-double-named helpers.
     */
    // MUST match the @SpringBootApplication scan root (RagApplication is at
    // com.example.rag.RagApplication, so com.example.rag is the auto-detected
    // root). Do NOT widen this to "com.example" — that would also include the
    // test-only synthetic fixture under com.fixtures.devdoublescan when it shares
    // the test runtime classpath, producing false-positive failures and
    // re-introducing the iteration-3 vacuous-pass class.
    private val productionBasePackage = "com.example.rag"

    /**
     * Allow-list of class simple-names that match the dev-double regex but
     * are NOT dev doubles. Add an entry here ONLY with a one-line
     * justification. The regex check is defense-in-depth; aggressive
     * allow-listing weakens the gate.
     */
    private val allowList: Set<String> = setOf(
        // "MockingjayController",  // real controller named after the book, not a test double
    )

    /**
     * Simple-name regex — anchored to the start of the class simple name.
     * NOTE: this pattern is anchored (^...) and applied AFTER `substringAfterLast('.')`
     * extracts the simple name. Do NOT interpolate this Pattern object back into
     * a fully-qualified-name regex (e.g. `".*\\.($devDoubleNamePattern).*"`) — the
     * `^` anchor cannot match after a package dot, and the resulting filter would
     * match zero classes (vacuous-pass regression). The classpath scanner uses
     * a separate match-everything filter; the simple-name match runs in Kotlin.
     */
    private val devDoubleNamePattern: Pattern = Pattern.compile(
        "^(Mock|Stub|Fake|Spy|Dummy|TestDouble|InMemory|Noop)",
        Pattern.CASE_INSENSITIVE,
    )

    @Test
    fun `every production class matching the dev-double name regex carries @DevOnlyBean`() {
        // useDefaultFilters = false: we control filtering. The include filter matches
        // every candidate (.*) — we then filter by simple name in Kotlin using
        // devDoubleNamePattern, which is correctly anchored against the simple name.
        // This avoids the iteration-2 bug where interpolating the anchored pattern
        // into a FQCN regex produced a vacuous match-zero filter.
        val scanner = ClassPathScanningCandidateComponentProvider(false).apply {
            addIncludeFilter(RegexPatternTypeFilter(Pattern.compile(".*")))
        }

        val ungated: List<String> = scanner.findCandidateComponents(productionBasePackage)
            .mapNotNull { bd -> bd.beanClassName }
            .filter { fqcn ->
                val simpleName = fqcn.substringAfterLast('.')
                devDoubleNamePattern.matcher(simpleName).find() && simpleName !in allowList
            }
            .filter { fqcn ->
                // Must NOT carry @DevOnlyBean (class-level). @Bean-method-level
                // markers are also valid; the Spring slice (DevDoubleGateTest)
                // catches that case. This scan focuses on class-level coverage.
                val cls = ClassUtils.forName(fqcn, javaClass.classLoader)
                cls.getAnnotation(DevOnlyBean::class.java) == null
            }

        assertThat(ungated)
            .withFailMessage(
                "FAIL THE BUILD: production classes whose simple name matches " +
                    "(?i)^(Mock|Stub|Fake|Spy|Dummy|TestDouble|InMemory|Noop) but do NOT carry " +
                    "@DevOnlyBean: %s. Either add the marker, rename the class, or add the simple " +
                    "name to DevDoubleClasspathScanTest.allowList with a one-line justification.",
                ungated,
            )
            .isEmpty()
    }

    @Test
    fun `dev-double name regex matches expected positives and rejects negatives (iteration-2 anchor regression guard)`() {
        // Self-test of the simple-name pattern. Pinned matrix prevents a future
        // refactor from re-introducing the iteration-2 vacuous-pass bug where the
        // anchored pattern was interpolated into a FQCN regex and matched nothing.
        val positives = listOf(
            "MockOrchestratorClient", "FakeAuthClient", "SpyEventBus",
            "InMemoryUserRepository", "DummyMetricsSink", "NoopProgressReporter",
            "StubFeatureFlagSource", "TestDoubleConversationStore",
            "mockServiceFactory",      // case-insensitive
        )
        val negatives = listOf(
            "RagController", "SecurityConfig", "OrchestratorClient",
            "OrchestratorMockingFactory",  // does NOT start with dev-double prefix
            "RealMockProvider",             // ditto
            "DataMockingHelper",            // ditto — anchor must be at start
        )
        for (simple in positives) {
            assertThat(devDoubleNamePattern.matcher(simple).find())
                .withFailMessage("regex must match dev-double simple name: %s", simple)
                .isTrue
        }
        for (simple in negatives) {
            assertThat(devDoubleNamePattern.matcher(simple).find())
                .withFailMessage("regex must NOT match non-dev-double simple name: %s", simple)
                .isFalse
        }
    }

    @Test
    fun `classpath scanner returns at least the known-ungated synthetic dev-double when no @DevOnlyBean is present (regression for filter-anchor bug)`() {
        // Self-test of the scanner pipeline. Constructs the same scanner shape
        // as the production check and runs it against a known package containing
        // a synthetic ungated dev-double class committed under test fixtures.
        // If this returns an empty list, the filter regex is broken and the
        // load-bearing layer is vacuous — same regression class Codex flagged in
        // iteration 2. (Add the synthetic fixture under
        // src/test/kotlin/com/fixtures/devdoublescan/MockSyntheticDouble.kt
        // — a class named `MockSyntheticDouble` with NO @DevOnlyBean annotation.
        // The fixture lives under the test tree only, NOT production, so it does
        // not trigger the production check above.)
        val fixturePackage = "com.fixtures.devdoublescan"
        val scanner = ClassPathScanningCandidateComponentProvider(false).apply {
            addIncludeFilter(RegexPatternTypeFilter(Pattern.compile(".*")))
        }
        val matches: List<String> = scanner.findCandidateComponents(fixturePackage)
            .mapNotNull { bd -> bd.beanClassName }
            .filter { fqcn -> devDoubleNamePattern.matcher(fqcn.substringAfterLast('.')).find() }

        assertThat(matches)
            .withFailMessage(
                "Scanner regression: expected to find MockSyntheticDouble fixture " +
                    "in $fixturePackage but found nothing. Either the fixture is missing " +
                    "or the include filter is broken (re-check iteration 2 anchor bug).",
            )
            .anyMatch { it.endsWith(".MockSyntheticDouble") }
    }
}
```

**Required test fixture for the regression test (commit alongside `DevDoubleClasspathScanTest.kt`):**

```kotlin
// src/test/kotlin/com/fixtures/devdoublescan/MockSyntheticDouble.kt
package com.fixtures.devdoublescan

import org.springframework.stereotype.Component

/**
 * Test-tree fixture only — exists to prove `DevDoubleClasspathScanTest`'s scanner
 * pipeline actually finds dev-double-named classes. NO @DevOnlyBean marker — that
 * is intentional. This class lives under the test tree, NOT production, so it does
 * NOT trigger the production gate. Do not move it under src/main.
 */
@Component
class MockSyntheticDouble
```

##### `SecurityBeansPresentTest.kt` — boot-time bean-presence sanity (catches scan-root drift)

Both `DevDoubleClasspathScanTest` and `DevDoubleGateTest` operate on slices or static classpath scans. Neither asserts that the **real** `@SpringBootApplication` context wires the load-bearing security beans (`SecurityWebFilterChain` + `ReactiveJwtDecoder`). If a future contributor moves `SecurityConfig` outside `com.example.rag` — putting it under, say, `com.example.config` — Spring Boot's default scan starts at `com.example.rag` and silently skips the configuration class. The app compiles, the slice tests still pass against their explicit `withUserConfiguration(...)`, but the deployed app has no JWT validator. This sanity test boots the actual application and asserts the beans are present.

```kotlin
// src/test/kotlin/com/example/rag/security/SecurityBeansPresentTest.kt
package com.example.rag.security

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder
import org.springframework.security.web.server.SecurityWebFilterChain

@SpringBootTest(
    // Boot the real RagApplication context. No web env needed — we only
    // inspect bean presence, not handle requests.
    webEnvironment = SpringBootTest.WebEnvironment.NONE,
    properties = [
        // Required for context startup; values are not exercised by this test
        // because no HTTP request is sent. Real validation is OboValidationTest's job.
        "app.entra.jwks-uri=http://localhost:0/jwks",
        "app.entra.audience=api://placeholder",
        "app.entra.issuer=https://placeholder/",
    ],
)
class SecurityBeansPresentTest {

    @Autowired private lateinit var ctx: ApplicationContext

    @Test
    fun `SecurityWebFilterChain bean is registered`() {
        val beans = ctx.getBeansOfType(SecurityWebFilterChain::class.java)
        assertThat(beans)
            .withFailMessage(
                "FAIL THE BUILD: no SecurityWebFilterChain bean is registered. " +
                    "SecurityConfig is likely outside the @SpringBootApplication scan root " +
                    "(expected com.example.rag.*). Move the config under the app package " +
                    "or set @SpringBootApplication(scanBasePackages = ...) explicitly.",
            )
            .isNotEmpty
    }

    @Test
    fun `ReactiveJwtDecoder bean is registered (catches scan-root drift)`() {
        val beans = ctx.getBeansOfType(ReactiveJwtDecoder::class.java)
        assertThat(beans)
            .withFailMessage(
                "FAIL THE BUILD: no ReactiveJwtDecoder bean is registered. " +
                    "Without it, oauth2ResourceServer().jwt() has no decoder and the auth " +
                    "boundary collapses. Likely cause: SecurityConfig package is outside the " +
                    "@SpringBootApplication scan root.",
            )
            .isNotEmpty
    }
}
```

**Failure modes the two tests catch together:**
- Source has `@Component class MockFooClient` without `@DevOnlyBean` → classpath-scan fires (independent of any test slice).
- Source has `@DevOnlyBean class FakeAuthClient` but the property gate misfires → Spring slice annotation check fires.
- Source has `@DevOnlyBean class MockOrchestratorClient` correctly gated, but `DevDoubleGateTest` slice forgot to include `DevDoublesConfig` → classpath-scan still validates the marker is present, so the test does not pass vacuously even when the slice is incomplete.
- Class named `MockingjayController` in source → classpath-scan fires unless allow-listed with justification.

#### Step D — OBO JWT validation in `SecurityConfig` (R6c) — **WebFlux reactive**

Spring Security reactive `oauth2ResourceServer().jwt()` is configured against the Entra ID JWKS URI with required `aud` and expected `iss`. Properties have **no defaults** — a missing property fails the app at startup, not at first request. This prevents silent acceptance of unsigned tokens.

**Reactive types (do NOT use the servlet variants):**
- `ServerHttpSecurity` (not `HttpSecurity`)
- `SecurityWebFilterChain` (not `SecurityFilterChain`)
- `ReactiveJwtDecoder` (not `JwtDecoder`)
- `NimbusReactiveJwtDecoder` (not `NimbusJwtDecoder`)

**CSRF posture decision (same step):** disable CSRF for stateless JWT-authenticated endpoints via `http.csrf { it.disable() }` on `ServerHttpSecurity`. Safety rationale: CSRF defends against cookie-based credential injection (browsers auto-attach cookies to cross-origin requests). Bearer headers cannot be auto-injected cross-origin — the attacker cannot read the token from another origin (CORS) and cannot make the browser attach it (no equivalent of `SameSite` for `Authorization`). For a stateless JWT API with no cookie auth, CSRF protection is theatre and breaks legitimate clients that don't fetch a CSRF token.

```kotlin
// src/main/kotlin/com/example/rag/config/SecurityConfig.kt
package com.example.rag.config

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
// src/test/kotlin/com/example/rag/security/JwtTestKit.kt
package com.example.rag.security

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

**Lifecycle ordering — load-bearing.** `@DynamicPropertySource` is invoked while Spring is *building the application context*, which happens **before** JUnit's `@BeforeAll`. If WireMock is started in `@BeforeAll` and the property supplier calls `wireMock.baseUrl()`, that supplier will execute against a not-yet-started server (or a stale port from a previous run) and the resulting `app.entra.jwks-uri` will be wrong. The test then either throws during context startup or wires `NimbusReactiveJwtDecoder` against an unusable URL — turning the OBO test into a vacuous pass that proves nothing about JWT rejection.

The fix: start WireMock **before** Spring touches dynamic properties. Use a JUnit 5 `static` initializer block on the `companion object` so the server is up by the time the class is loaded — the same JVM phase that runs `@DynamicPropertySource`. Stop the server via a JVM shutdown hook (or `@AfterAll`; both work because shutdown is idempotent for WireMock). Do NOT rely on `@BeforeAll` to start WireMock for this test.

```kotlin
// src/test/kotlin/com/example/rag/security/OboValidationTest.kt
package com.example.rag.security

import com.github.tomakehurst.wiremock.WireMockServer
import com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment
import org.springframework.http.MediaType
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.reactive.server.WebTestClient

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class OboValidationTest {

    @Autowired private lateinit var webClient: WebTestClient

    companion object {
        private const val AUDIENCE = "api://gpt-rag-orchestrator-test"
        private const val ISSUER   = "https://login.test.example/v2.0"

        // The documented endpoint is POST /api/rag/ask (per INTEGRATION_PLAN §3.1
        // and the playbook's RagController in Unit 7). All six OBO assertions
        // below MUST exercise that exact verb + path; using GET would test a
        // route that does not exist and either return 404/405 or pressure
        // implementers to add a dummy GET handler — both weaken the gate.
        private val askRequestBody = mapOf(
            "ask" to "test prompt for OBO validation",
            "conversationId" to "test-conversation-1",
            "userContext" to emptyMap<String, Any>(),
        )

        private val wireMock: WireMockServer = WireMockServer(wireMockConfig().dynamicPort())

        // ── LOAD-BEARING ────────────────────────────────────────────────────────
        // Static initializer runs at class-load time, BEFORE Spring resolves
        // @DynamicPropertySource. By the time the property supplier reads
        // wireMock.baseUrl() the server is already listening on its dynamic port.
        // Do NOT move this into @BeforeAll — that runs AFTER context startup.
        // ────────────────────────────────────────────────────────────────────────
        init {
            wireMock.start()
            JwtTestKit.stubJwks(wireMock)
            // Idempotent shutdown — covers JVM exit even if the test class is
            // re-loaded across forked JUnit runs.
            Runtime.getRuntime().addShutdownHook(Thread {
                if (wireMock.isRunning) wireMock.stop()
            })
        }

        /** Bind Spring properties at context startup. WireMock is already running (see init). */
        @JvmStatic
        @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            registry.add("app.entra.jwks-uri") { "${wireMock.baseUrl()}/.well-known/jwks.json" }
            registry.add("app.entra.audience") { AUDIENCE }
            registry.add("app.entra.issuer")   { ISSUER }
            // Activate MockOrchestratorClient so a valid token reaches a real handler
            // that returns 200 with an SSE body — required for the valid-JWT case below.
            // The dev-double gate (DevDoubleGateTest) is enforced in a different test
            // class with this property unset; here we deliberately enable it so the
            // OBO leg has a working downstream stub, isolating what this test asserts:
            // "the auth filter accepts a real token and the request reaches the handler."
            registry.add("app.dev-doubles.enabled") { "true" }
        }
    }

    private fun postWithoutAuth() = webClient.post().uri("/api/rag/ask")
        .contentType(MediaType.APPLICATION_JSON)
        .accept(MediaType.TEXT_EVENT_STREAM)
        .bodyValue(askRequestBody)

    private fun postWithAuth(token: String) = postWithoutAuth()
        .header("Authorization", "Bearer $token")

    @Test fun `no Authorization header returns 401`() {
        postWithoutAuth().exchange().expectStatus().isUnauthorized
    }

    @Test fun `malformed JWT returns 401`() {
        postWithAuth(JwtTestKit.MALFORMED).exchange().expectStatus().isUnauthorized
    }

    @Test fun `forged JWT signed by wrong key returns 401`() {
        // Structurally valid; signature verification against JWKS fails because the attacker
        // key is never published in publishedJwkSet().
        val token = JwtTestKit.forgedJwt(audience = AUDIENCE, issuer = ISSUER)
        postWithAuth(token).exchange().expectStatus().isUnauthorized
    }

    @Test fun `JWT with wrong aud claim returns 401`() {
        val token = JwtTestKit.wrongAudienceJwt(expectedAudience = AUDIENCE, issuer = ISSUER)
        postWithAuth(token).exchange().expectStatus().isUnauthorized
    }

    @Test fun `JWT with wrong iss claim returns 401`() {
        val token = JwtTestKit.wrongIssuerJwt(audience = AUDIENCE, expectedIssuer = ISSUER)
        postWithAuth(token).exchange().expectStatus().isUnauthorized
    }

    @Test fun `valid JWT reaches the POST handler successfully`() {
        // With a valid token, the auth filter passes and the request reaches RagController.
        // MockOrchestratorClient (gated on app.dev-doubles.enabled=true above) provides the
        // 200 SSE response body. If the controller stack changes (or the mock is removed),
        // tighten this assertion accordingly — but it MUST NOT be 401/403.
        val token = JwtTestKit.validJwt(audience = AUDIENCE, issuer = ISSUER)
        postWithAuth(token).exchange()
            .expectStatus().isOk
            .expectHeader().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM)
    }
}
```

**No `TODO(...)` placeholders.** Every fixture is built deterministically from `JwtTestKit`. The forged path is signed by an in-memory keypair that is never published in the JWKS endpoint — `NimbusReactiveJwtDecoder` cannot resolve a matching `kid`/key and rejects the token, exactly as production would reject an attacker-signed JWT.

#### Step F — Generate `MockOrchestratorClient.kt` (the one dev double the gate tests reference)

`DevDoubleGateTest` (Step C) lists `MockOrchestratorClient::class.java` in `withUserConfiguration(...)`, and `OboValidationTest` (Step E) sets `app.dev-doubles.enabled=true` so this mock is registered when a valid JWT is exercised. Both tests are generated in this unit, in this phase. Therefore the mock class itself MUST be generated in this phase too — generating it later (e.g., in `04-contract-tests`) creates a compile-time ordering bug: phase-03 tests reference a phase-04 class that does not yet exist on the classpath.

The mock implements the `OrchestratorClient` interface defined in earlier units of this playbook. **Every cross-package type used in the mock is imported explicitly** — bare names would silently fail to resolve in a different package and produce a non-compiling scaffold.

```kotlin
// src/main/kotlin/com/example/rag/dev/MockOrchestratorClient.kt
package com.example.rag.dev

import com.example.rag.config.OrchestratorProperties             // configuration properties (Unit 5/6 output)
import com.example.rag.config.annotations.DevOnlyBean             // gate marker (Step A)
import com.example.rag.service.AskChunk                           // sealed class — emitted variants (Unit 7 output)
import com.example.rag.service.OrchestratorClient                 // interface (Unit 7 output)
import com.example.rag.web.dto.UserContext                        // request DTO field (Unit 4 output)
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import org.springframework.stereotype.Component

/**
 * Offline-dev fallback. Returns canned SSE chunks/citations/done events.
 * Gated by @DevOnlyBean (composes @ConditionalOnProperty(app.dev-doubles.enabled,
 * matchIfMissing = false)) so it CANNOT register in production by accident.
 *
 * Path is documented under playbook 04 Step 3, but the file itself lives here
 * because phase-03 tests (DevDoubleGateTest, OboValidationTest) reference it.
 */
@DevOnlyBean
@Component
class MockOrchestratorClient(
    val properties: OrchestratorProperties,
) : OrchestratorClient {

    override fun askOrchestrator(
        ask: String,
        conversationId: String,
        userContext: UserContext,
    ): Flow<AskChunk> = flow {
        emit(AskChunk.Chunk("This is a mocked response to: \"$ask\""))
        delay(100)
        emit(AskChunk.Citation("Sample Doc", "https://example.com/doc"))
        emit(AskChunk.Done())
    }
}
```

**Import-resolution sanity check.** All five cross-package types (`OrchestratorProperties`, `OrchestratorClient`, `AskChunk`, `UserContext`, `DevOnlyBean`) are imported by fully qualified name. If a previous unit places any of them in a different package, update the import lines here verbatim — Kotlin will not silently fall through to an alternate package.

#### Step G — Commit pattern

Per existing TDD discipline. **Mock-orchestrator generation MUST come before the gate tests reference it** (commits 1-2 below), otherwise phase 03 fails to compile.

1. `feat(rag-be): MockOrchestratorClient + DevOnlyBean meta-annotation`
2. `feat(rag-be): RagApplication scaffold (RagApplication.kt + scanBasePackages alignment)` — only if missing from earlier units
3. `test(rag-be): DevDoubleClasspathScanTest red`
4. `test(rag-be): DevDoubleClasspathScanTest green`
5. `test(rag-be): DevDoubleGateTest (Spring slice) red`
6. `test(rag-be): DevDoubleGateTest (Spring slice) green`
7. `test(rag-be): JwtTestKit + WireMock JWKS publisher`
8. `test(rag-be): SecurityConfig OBO JWT (jwks-uri, aud, iss) reactive + OboValidationTest red`
9. `test(rag-be): SecurityConfig OBO JWT (jwks-uri, aud, iss) reactive + OboValidationTest green`
10. `test(rag-be): SecurityBeansPresentTest (boot-time scan-root sanity)`

#### Step H — Verification (this unit fails the build when…)

All three tests **fail the build** under the following conditions:

**`DevDoubleClasspathScanTest` fails the build when (load-bearing layer):**
- A production class under `com.example` whose simple name matches `(?i)^(Mock|Stub|Fake|Spy|Dummy|TestDouble|InMemory|Noop)` does NOT carry `@DevOnlyBean` and is NOT in the allow-list.
- This catches the "ungated dev double exists in source" case independent of whether any Spring test slice happens to include it.

**`DevDoubleGateTest` fails the build when (gating-misfire layer):**
- A `@DevOnlyBean`-marked bean registers when `app.dev-doubles.enabled` is unset (the property gate or the meta-annotation broke).
- A bean whose simple class name matches the regex registers in the explicit slice without the property set.
- The positive integration check fails — i.e., dev-double beans do NOT register when `app.dev-doubles.enabled=true`. (Catches accidental over-locking.)

**`OboValidationTest` fails the build when:**
- A request without `Authorization` header returns anything other than 401.
- A malformed JWT, a forged JWT (signed by a key NOT in the JWKS), a JWT with wrong `aud`, or a JWT with wrong `iss` returns anything other than 401.
- A valid JWT does NOT return 200 with `Content-Type` compatible with `text/event-stream`.
- `WireMockServer` is not listening at `wireMock.baseUrl()` when Spring resolves `@DynamicPropertySource` (the static initializer block in the companion object guarantees this; if scaffolders move the start logic into `@BeforeAll`, the test loses this guarantee).

**`SecurityBeansPresentTest` fails the build when:**
- The real `RagApplication` context boots without a `SecurityWebFilterChain` bean. Indicates `SecurityConfig` was placed outside the scan root (`com.example.rag.*`) or `@EnableWebFluxSecurity` is missing.
- The context boots without a `ReactiveJwtDecoder` bean. Indicates the same scan-root regression — without the decoder, `oauth2ResourceServer().jwt()` has no signature/claim validator and the auth boundary collapses to "any string after Bearer is accepted."

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
