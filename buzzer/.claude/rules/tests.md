---
paths: ["**/*.test.ts", "**/*.test.tsx"]
---

# Test conventions

- Use Vitest.
- Keep tests deterministic. Inject `now`, use `vi.useFakeTimers()` for windows and reopens, and seed any randomness. Never sleep or wait on real time.
- Each test proves one behaviour from a "Done when" bullet or a spec rule. Name it after that behaviour.
- A test must fail if the behaviour breaks. Assert on the outcome, not on the fact that a function was called.
- Leak tests serialise the whole view (`JSON.stringify`) and search for the answer and host-notes strings.
