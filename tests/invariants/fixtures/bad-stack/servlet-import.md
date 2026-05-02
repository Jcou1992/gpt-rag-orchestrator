# Stack invariant test fixture — INTENTIONALLY BAD

This file places a servlet-stack import inside a Kotlin code block.
`check-stack-invariant.mjs` must reject it (Spring Boot WebFlux is the
locked stack; servlet `HttpSecurity` / `SecurityFilterChain` / `MockMvc`
imports are forbidden because they fail to compile or wire the wrong
runtime path on a reactive backend).

```kotlin
package com.example.bad

import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.SecurityFilterChain
import org.springframework.test.web.servlet.MockMvc

class BadConfig {
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain = TODO()
}
```
