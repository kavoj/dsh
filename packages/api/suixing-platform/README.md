---
description: "SuiXing bridge contract for agent.35sz.top: the uniform envelope, its error codes, and one client that runs over a live HTTP transport or the fixture-backed mock."
kind: "package-reference"
---

# @deepseek-ai/dsh-api-suixing-platform

English | [中文](README.zh.md)

## Summary

The contract between the SuiXing distribution and `agent.35sz.top` (随星问). It reads the platform's uniform response envelope `{code, message, data, timestamp, path}`, classifies the codes the SX-002 probe observed, and exposes one client that runs unchanged against the live HTTP transport and against a mock answering from recorded, sanitized payloads. A failure carries its platform code, its class, the request path, and the HTTP status, so a caller can report where it broke without reading a stack trace.

## Table of Contents

- [Use this package](#use-this-package)
- [The envelope](#the-envelope)
- [One client, two transports](#one-client-two-transports)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

```ts
import {
  createHttpTransport,
  createSuixingPlatformClient,
  isPlatformError,
} from '@deepseek-ai/dsh-api-suixing-platform'

const client = createSuixingPlatformClient(createHttpTransport({ baseUrl: 'https://agent.35sz.top' }))
const { token } = await client.login({ username: 'demo-admin', password: '…' })
const team = await client.getCanmouTeam(token)
```

Typed methods cover the endpoints whose shapes the probe pinned (`login`, `getUserInfo`, `redeemCardKey`, `listModels`, `getCanmouTeam`, `listWorkflows`, `getStorageUsage`, `getChatConfig`). SX-006 then re-checked the whole surface against the platform's own source (`buildingai`, branch `feature/mv-agent`), which enumerates 541 routes across three planes and confirms the SuiXing client consumes only the `/api` plane; the SuiXing-side inventory lives in `SX-006-平台API梳理.md`. `client.send({ method, path, token, query, body })` reaches everything not yet typed, until each path earns a wrapper and a recorded fixture.

This package owns no UI, no persistence, and no credential storage. The caller supplies the token on every authenticated call and decides where it lives (the SX-010 rule: long-lived credentials belong in OS secure storage, never in browser storage, URLs, or logs).

<a id="the-envelope"></a>
## The envelope

Every response is `{code, message, data, timestamp, path}`. `20000` is success; anything else is a failure and is thrown as `SuixingPlatformError`, never returned as `undefined`. Observed codes: `40000` invalid-request, `40100`/`40200` unauthenticated, `40300` forbidden, `40400` not-found, `40900` conflict, `42900` rate-limited, `50000` server-error. An unmapped code degrades to `unknown` and keeps its raw code rather than throwing a second, less useful error.

A payload that is not an envelope is itself a failure: the platform serves its SPA for unknown paths, so HTML arriving where JSON was expected means the route is wrong, and `code: 0` names that rather than hiding it.

<a id="one-client-two-transports"></a>
## One client, two transports

Both transports hand their raw payload to the same `readEnvelope`, so "what counts as success" cannot drift between live and simulated platforms. `createHttpTransport` adds only the three things a mock does not need: URL assembly, the bearer header, and JSON parsing. `createMockTransport` answers from `PLATFORM_FIXTURES` and mirrors the platform's not-found envelope for an unrecorded path.

Fixtures hold field sets captured by the probe, with every value synthetic — no live token, account, e-mail address, or upload URL is stored in the repository. Every entity type carries an index signature, so a field the platform adds survives the trip instead of being dropped or rejected.

<a id="model-experience"></a>
## Model Experience

None, as this bridge issues platform requests and registers nothing model-facing.

#### KV Cache effect

No direct effect; it neither composes prompts nor carries model input.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Only the endpoints listed above are typed; the remaining 249 `/api` routes are reachable through `send` but unmodelled.
- The stream endpoint (`/api/ai-agents/:id/chat/stream`) is not wrapped. SX-006 established from source that it speaks the Vercel AI SDK UI Message Stream (`pipeUIMessageStreamToResponse`), not a bespoke event set, and that `responseMode: "blocking"` returns one enveloped JSON reply instead; the parser and its abort path are deferred to SX-007, and no fixture stands in for either.
- Rate limiting is not modelled. The probe observed no `X-RateLimit-*` or `Retry-After` header on authenticated calls, so retry/backoff policy is undefined until measured (SX-010).
- Card-key redemption is wired, but device binding is not. `POST /api/card-key/redeem` is confirmed the only front-office activation route, and it grants points or membership; the platform carries no device fingerprint, so one card can activate several machines until product decides whether that matters.
- Fixtures are hand-sanitized from probe output and reconciled against platform source; they pin field sets, not byte-exact platform responses.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`src/types.ts` is types-only and therefore outside the coverage requirement (the repository exempts `packages/*/*/src/types.ts`). `src/index.ts` is a pure re-export barrel with no executable range V8 can attribute, so it is listed in the coverage exclusion beside the equivalent `packages/api/remotes/src/index.ts` entry.

</details>

**Runtime invariant:** No companion is published. A caller owns the token lifecycle and decides what to do with a `SuixingPlatformError`.
