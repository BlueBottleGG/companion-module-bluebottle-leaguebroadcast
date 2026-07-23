# bluebottle-rpc: evaluate `Authorization: Bearer` for no-Origin peers

Proposal for a framework fix in `external/bluebottle-rpc` (`BlueBottleClient.Rpc`), written up
for separate implementation. Found during the Companion-module remote-host work (2026-07-23).

Status: **implemented** (2026-07-23) — bluebottle-rpc `ed14c99` ("feat: evaluate Bearer
pre-auth for no-Origin peers before origin policing"), rolled into leaguebroadcast via the
`external/bluebottle-rpc` submodule bump; the synthetic-origin workaround
(`CompanionClientOrigin` / `http://companion.bluebottle.invalid`) is removed there. This module
needs no changes — sending both Origin and Bearer remains correct (a valid token skips origin
policing); dropping the Origin header is optional and pinned by `src/__tests__/rpc.spec.ts:150`
if ever done.

---

## 1. Problem

`RpcWebSocketServer.AcceptAsync` (`BlueBottleClient.Rpc\RpcWebSocketServer.cs:32`) only reads
the `Authorization: Bearer` header for peers that present an **allowlisted cross-Origin**
header. `GetBearerToken` (line 179) has exactly one call site — line 69, inside the
`else` branch of the origin handling:

```csharp
if (origin.Length > 0)
{
    if (IsOwnOrigin(origin, context.Request)) { ownOriginBrowserPeer = true; }
    else if (!_options.AllowedBrowserOrigins.Contains(origin)) { /* 403 */ }
    else
    {
        string? token = GetBearerToken(context.Request);   // ← only place the header is read
        ...
    }
}
```

A **no-Origin native/tooling peer** (any non-browser client: the Companion module, scripts,
CLI tools) skips the whole block — its `Authorization` header is silently ignored and it falls
through to the scope assignment at lines 94-113 (loopback → `local`, host-supplied `clientId`
→ that id, otherwise anonymous).

This contradicts two pieces of documentation that both promise native Bearer pre-auth:

- The comment directly above the code, lines 44-46: _"A Bearer header (which browser pages
  cannot set on an upgrade) may pre-authenticate native/tooling callers; presenting an
  invalid one fails closed."_
- `LeagueBroadcast/docs/architecture.md:135-137`: _"an `Authorization: Bearer` header
  (settable by native/tooling callers only, not browser pages) may pre-authenticate at
  upgrade — an invalid one fails closed 401."_

### Production workaround currently shipped

Because of this gap, the Companion pairing feature ships a synthetic origin:

- LeagueBroadcast allowlists `http://companion.bluebottle.invalid`
  (`BlueBottleClient.Web\Startup.cs`, constant `CompanionPairingController.CompanionClientOrigin`,
  commit `1afd5b57`).
- The Companion module sends **both** `Origin: http://companion.bluebottle.invalid` and
  `Authorization: Bearer <token>` when a pairing token is configured
  (`companion-module-bluebottle-leaguebroadcast/src/client/rpc.ts`, `createPairedWebSocket`).
- With no token configured the module sends **no** custom headers, because a foreign Origin on
  loopback would downgrade the connection from auto-`local` to anonymous.

It works, but it routes native tooling through browser-security machinery, and every future
tooling integration would need its own allowlisted fake origin.

## 2. Current behavior matrix (verified, `RpcWebSocketServer.cs:47-113`)

| Peer                        | Origin    | Bearer                      | Result today                                                            |
| --------------------------- | --------- | --------------------------- | ----------------------------------------------------------------------- |
| Native, loopback            | —         | —                           | `local` (auto-trust, line 98-101)                                       |
| Native, loopback            | —         | valid **or invalid**        | **header ignored** → `local`                                            |
| Native, remote              | —         | —                           | anonymous (accepted; per-call 401 on `[RpcRequireAuth]`, lines 299-303) |
| Native, remote              | —         | valid                       | **header ignored** → anonymous ← the gap                                |
| Native, remote              | —         | invalid                     | **header ignored** → anonymous (docs promise 401)                       |
| Broadcast-Server host path  | —         | — (clientId param)          | authenticated as `clientId` (line 110-113)                              |
| Browser, own-origin         | same-host | n/a (browsers can't set it) | `local`/`lan` per `TrustSameHostOriginPeers`                            |
| Browser, allowlisted origin | foreign   | absent                      | anonymous, elevate via pairing RPC                                      |
| Tooling, allowlisted origin | foreign   | valid                       | authenticated (line 94-97) — the workaround path                        |
| Tooling, allowlisted origin | foreign   | invalid                     | 401 fail-closed (line 73-78)                                            |
| Any, non-allowlisted origin | foreign   | anything                    | 403 before the header is read (line 61-66)                              |

## 3. Proposed fix

**Hoist Bearer evaluation above the origin handling entirely.** A Bearer header can only be
set by native/tooling callers (browsers cannot attach headers to a WebSocket upgrade), so a
presented token identifies the caller class by itself — judge the connection on the token and
skip origin policing, which exists to constrain _browser_ pages.

```csharp
// In AcceptAsync, before the `if (origin.Length > 0)` block:
string? token = GetBearerToken(context.Request);
if (token != null)
{
    pairedClientId = _pairingTokens.Validate(token);
    if (pairedClientId == null)
    {
        Logger.Warning("RPC WebSocket upgrade rejected: invalid pairing token (origin: {Origin})",
            origin.Length > 0 ? origin : "none");
        context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
        return;
    }
    // Valid token: skip origin policing — only native/tooling callers can set the header.
}
else if (origin.Length > 0)
{
    // ... existing origin handling, minus its inner GetBearerToken block ...
}
```

The scope-assignment block (lines 94-113) needs no changes — `pairedClientId` already takes
precedence (line 94), and the `clientId`/loopback/`lan` fallbacks only apply when no token was
presented.

### Behavior changes this introduces (each deliberate)

1. **No-Origin + valid Bearer → authenticated** (was anonymous). The actual fix; makes both
   doc claims true.
2. **No-Origin + invalid Bearer → 401 fail-closed** (was anonymous — or worse, auto-`local`
   on loopback). Note the loopback nuance: a local tool presenting a stale/revoked token now
   gets 401 instead of silent `local` trust. That is the documented and correct semantic —
   explicitly presenting a bad credential must not fall back to ambient trust — but it is a
   behavior change for any local tool that sends garbage in `Authorization` today.
3. **Own-origin + Bearer → evaluated** (was ignored). Gives own-origin-served native shells
   (WebView2 etc.) a deterministic identity if they ever pair.
4. **Non-allowlisted Origin + valid Bearer → authenticated** (was 403). This is what lets the
   synthetic-origin allowlist be deleted: the token alone is sufficient. A browser page can
   never reach this path (cannot set the header), so the 403 drive-by protection is not
   weakened.
5. Allowlisted-origin paths, the anonymous elevate-via-RPC flow, `TrustSameHostOriginPeers`,
   and the Broadcast-Server `clientId` path are **unchanged**.

## 4. Security analysis

- **No new capability**: a valid pairing token already grants full authenticated scope via the
  workaround path; the fix only removes the fake-origin ceremony.
- **Fail-closed** on invalid tokens in every branch, matching the existing allowlisted-origin
  behavior and the documented contract.
- **Browser threat model intact**: drive-by pages always carry their true Origin and can never
  set upgrade headers; every browser-facing decision path is untouched.
- **Revocation**: unchanged — `RpcPairingTokenStore.Revoke`/`RevokeClient` +
  `DeauthenticateClient` de-elevate live connections regardless of how they authenticated.
- Never log the token value (the sketch logs only the origin presence).

## 5. Tests

Follow the framework's existing test layout (if `AcceptAsync` has no direct harness, drive it
with a faked `HttpContext`, or add integration-style coverage next to the app's
`RpcSmokeTest.cs` pattern):

1. No-Origin + valid Bearer → accepted, `[RpcRequireAuth]` method succeeds (authenticated as
   the token's clientId).
2. No-Origin + invalid Bearer, remote → HTTP 401 at upgrade.
3. No-Origin + invalid Bearer, **loopback** → HTTP 401 (explicit credential beats ambient
   trust — the deliberate change #2).
4. Regression: no-Origin, no header, loopback → `local`.
5. Regression: no-Origin, no header, remote → anonymous, per-call 401.
6. Non-allowlisted Origin + valid Bearer → accepted authenticated (change #4).
7. Regression: non-allowlisted Origin, no token → 403.
8. Regression: allowlisted Origin, no token → anonymous; + invalid token → 401; + valid token
   → authenticated.
9. Regression: `clientId` host path still authenticates when no token is presented.

## 6. Rollout & cleanup

1. Implement in the `bluebottle-rpc` repo (it is a submodule with its own history — branch,
   commit, then bump the submodule pointer in LeagueBroadcast).
2. Update the two over-promising doc spots so they match reality (they become true with the
   fix): the `AcceptAsync` comment block (lines 40-46) and
   `LeagueBroadcast/docs/architecture.md:135-137`.
3. **Optional cleanup, any time after the fixed framework ships in a released app build**
   (fully backward-compatible either way, since the allowlisted-origin+token path is
   unchanged):
   - App: remove the `http://companion.bluebottle.invalid` allowlist line in `Startup.cs` and
     the `CompanionClientOrigin` constant.
   - Companion module: drop the `Origin` header from `createPairedWebSocket` (keep sending
     `Authorization` only). Gate this on the module's minimum-app-version check, or just keep
     sending both forever — sending both remains correct against both old and fixed servers.
