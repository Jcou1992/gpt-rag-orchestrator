# R5 invariant test fixture — INTENTIONALLY BAD

This file restates the canonical SSE schema inline. `check-r5-invariant.mjs`
must reject it (parser-level: any fenced ```json block whose JSON object
contains BOTH `oneOf` and `additionalProperties` is a restatement of the
canonical schema).

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "type": { "const": "chunk" },
        "text": { "type": "string" }
      },
      "required": ["type", "text"]
    }
  ]
}
```
