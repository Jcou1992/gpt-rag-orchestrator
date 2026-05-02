# Stack invariant test fixture — INTENTIONALLY BAD

This file places EVERY forbidden servlet-stack import inside Kotlin / Java
code blocks. `check-stack-invariant.mjs` must reject all of them (Spring
Boot WebFlux is the locked stack; servlet imports either fail to compile
or wire the wrong runtime path on a reactive backend).

The fixture must trigger every entry in the script's FORBIDDEN list so
the round-32 harness can assert each sentinel individually.

```kotlin
package com.example.bad

// Servlet Spring Security (must use ServerHttpSecurity / SecurityWebFilterChain instead).
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity

@EnableWebSecurity
class BadConfig {
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain = TODO()
}
```

```kotlin
package com.example.bad

// Servlet JWT decoder (must use ReactiveJwtDecoder / NimbusReactiveJwtDecoder).
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder

class BadJwtConfig {
    fun jwtDecoder(): JwtDecoder = NimbusJwtDecoder.withJwkSetUri("...").build()
}
```

```kotlin
package com.example.bad

// Servlet test stack (must use WebTestClient).
import org.springframework.test.web.servlet.MockMvc
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.test.web.servlet.result.MockMvcResultMatchers

@AutoConfigureMockMvc
class BadTest {
    val mockMvc: MockMvc? = null
}
```

```java
package com.example.bad;

// Servlet API — WebFlux has no servlet API.
import jakarta.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public class BadServlet {}
```

```kotlin
package com.example.bad

// Fully-qualified-name usage WITHOUT an import — closes the round-33
// bypass class. The rule must match the FQN regardless of `import`.
class BadFqnUsage {
    fun configure(http: org.springframework.security.config.annotation.web.builders.HttpSecurity): org.springframework.security.web.SecurityFilterChain = TODO()
}
```
