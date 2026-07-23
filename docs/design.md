# System Design — companion-module-league-broadcast

Bitfocus Companion connection module for **LeagueBroadcast** (BlueBottleGG), giving broadcast
operators Stream Deck / surface control over live League of Legends productions.

Status: **rev 3 — as built (v0.1.0)** · Date: 2026-07-23 · Targets: Companion ≥ 4.2, LeagueBroadcast local API (port 58869)

> Rev 2: transport flipped from REST+`/ws/ui` to the FlatBuffers RPC (`/ws/rpc`) after
> confirming the app is transitioning to RPC-only and `caster_mode` is explicitly the
> replacement for the caster HTTP surface. REST remains only as a transition fallback for
> surfaces that have no RPC namespace yet.
>
> Rev 3: updated to as-built state after implementation. Key deltas from rev 2:
>
> - Server subscription is named **`SubscribeLocalPanelState`** (`caster_mode.subscribe_local_panel_state`)
>   — repo rule requires RPC method names unique across ALL interfaces; `SubscribePanelState`
>   was taken by the relay contract.
> - `CasterPanelStateDto.GamePhase` carries the **full 7-value `GameState` enum**
>   (0 OutOfGame, 1 Loading, 2 Running, 3 Paused, 4 Mocking, 5 GameOver, 6 ChampionSelect),
>   not the coarse 4-value mapping the DTO comment implied.
> - The RPC runtime needed **no Node patches** (document access was already guarded); it is
>   **vendored** into `src/vendor/` (runtime + caster_mode/cinematics/ping stubs) instead of
>   consumed from npm — npm packaging of the client remains future work (§4.3).
> - `InstanceStatus.InsufficientPermissions` does not exist in base 1.14 — tier-block uses
>   **`AuthenticationFailure`** with the Basic-tier message.
> - **Cinematics shipped in v1** (arm/go/stop/play + playback feedback) — the RPC surface was
>   already complete. `overlaySet` (raw overlay types), `seriesSelect`, and `styleSetActivate`
>   moved to the Phase-2 backlog instead (see §5.4 note).
> - Tier gating landed server-side in parallel (audit session): `caster_mode.execute` throws
>   `RpcException.Unauthorized` (401) on feature-gate rejections; the module keys on that.

---

## 1. Requirements

### 1.1 Functional

- Trigger every common live-production action from a Companion surface: in-game overlay
  show/hide/toggle, recap/teamfight flows, champion-detail pinning, postgame stat screens,
  champ-select & rehearsal (mock) control, series/match bookkeeping, caster page switching,
  and a panic "hide everything" button.
- Reflect live state on buttons: overlay visibility, game phase, active caster page, mock state,
  active postgame component, tier/entitlement, connection health.
- Expose broadcast state as Companion variables (team names, series score, game clock, phase…)
  for use in button text and triggers.
- Ship rich presets so a producer gets a working page layout via drag-and-drop, organized by
  broadcast phase (Setup → Champ Select → In-Game → Post-Game).
- Feature-gate Companion control behind LeagueBroadcast **Basic tier**, enforced **server-side**.

### 1.2 Non-functional

- **Latency**: action → overlay change well under 250 ms on localhost/LAN.
- **Resilience**: LeagueBroadcast restarts mid-show must self-heal; the module must never wedge
  Companion (no unbounded timers, clean `destroy()`).
- **Performance**: batched variable updates, targeted `checkFeedbacks()`, coalesced game-clock
  updates (≤ 1 Hz).
- **Zero-config default**: `127.0.0.1:58869` works out of the box on the broadcast PC.
- **Store-distributable**: MIT license, `companion-module-build` packaging, semver tags,
  Bitfocus developer-portal submission.
- **Alignment with app direction**: LeagueBroadcast is migrating to RPC-only. The module must
  ride that migration, not extend the legacy REST/JSON-WS stack's lifetime.

### 1.3 Constraints

- Module code must be MIT-compatible for official store distribution → the module itself is
  **free & open source**; monetization happens via the app tier (precedent: vMix, H2R Graphics,
  Spotify-Premium-only module).
- Companion module runtime is Node 22 (webpack-bundled by `companion-module-build`) — any RPC
  client code must run outside a browser and be consumable from npm (or vendored).
- Template as cloned pins `@companion-module/base` ~1.14.1 (API 1.14 → Companion 4.2+). Current
  upstream is 2.1.x (API 2.1 → Companion 5.0+ only, released July 2026).

---

## 2. Research summary (what we're building against)

### 2.1 LeagueBroadcast control surface (verified in repo)

- **One embedded Kestrel server, default port 58869** (`WebAppGlobals.cs:9`). REST under `/api`,
  plain-JSON WebSockets under `/ws/*`, FlatBuffers RPC at `/ws/rpc`.
- **The app is transitioning to RPC-only.** `BlueBottleClient.Web/Rpc/CasterModeRpc.cs:12-16`
  documents `caster_mode` as the "RPC replacement for the caster panel's HTTP surface
  (GET/POST api/settings/castermode, api/ingame/showing, select-latest/teamfight/deselect
  actions, activeOverlays)". Existing host-side namespaces (`BlueBottleClient.Web/Rpc/`):
  `caster_mode`, `cinematics`, `settings`, `subscription`, `window`, `scene`, `account`,
  `profile`, `notify`, `advisory`, `ping`, `server`, `caster_remote`, `championDetail`,
  `hosted_workspace`, `drawing_client`.
- **The sanctioned action seam**: every caster action funnels through `CasterCommandExecutor`
  driven by `CasterCommandDto` with 13 command types (`toggle-overlay`, `deactivate-all`,
  `postgame-show`, `champion-detail-pin`, `damage-select-latest/deselect`,
  `objective-select-latest/deselect`, `teamfight-start/stop/select-latest/deselect`,
  `page-switch`). **`caster_mode.Execute(CasterCommandDto)` exposes all of them over RPC
  today**, returning `CasterCommandResultDto { Ok, Error, EntryJson }` (`CasterModeRpc.cs:96-106`).
  `GetConfig` / `GetActiveOverlays` provide the snapshot reads.
- **Overlay catalog** (`CasterActionCatalog.cs`): ~30 overlay types, each with a `MinFeature`
  gate (mostly `BasicTier`; Scoreboard, Inhibitors, pit timers, Twitch are free) and capability
  flags (teams / single players / time period / custom settings).
- **Caster panel model**: user-configured button instances + named pages (literally called
  "Stream Deck pages" in `CastermodeConfig.cs:200`) — the module mirrors the operator's own
  button/page config, not just raw overlay types. The remote-caster relay already publishes a
  `CasterPanelStateDto` snapshot (buttons incl. per-button `Available`, activePageId, team
  names, `GamePhase`) via `CasterRemoteBridge` — a ready-made shape for a local subscription.
- **RPC transport & auth** (`docs/architecture.md:120-141`): connections are gated pre-upgrade
  on the `Origin` header. Native peers (no Origin) on **loopback auto-authenticate as `local`**.
  Foreign browser Origins need allowlisting + pairing-token elevation
  (`RpcPairingTokenStore`, SHA-256-hashed, revocable). **Native/tooling callers may
  pre-authenticate at upgrade with an `Authorization: Bearer` header** — the server side of a
  remote-Companion auth story already exists.
- **TS client runtime** (`external/bluebottle-rpc/ts`, npm workspace `@bluebottle/rpc`):
  single-file, **zero runtime dependencies** (hand-rolled FlatBuffers codec), uses the global
  `WebSocket`, exponential backoff + jitter + heartbeat + `reconnectNow()`, re-issues
  subscription channels exactly once on reconnect, typed connection events
  (`connected | disconnected | reconnecting | reconnect-failed`). Browser-only in two spots:
  `document.visibilitychange` listener (`index.ts:909-913`) and no way to set upgrade headers.
  Ships raw TS (`main: ./src/index.ts`), workspace-internal — not yet externally consumable.
  Generated per-namespace TS stubs are emitted at build into `web/*/rpc/generated/`.
- **Legacy REST** (transition fallback only): Swagger at `/swagger`, telemetry buckets
  non-browser callers as `RestClient`, legacy bare-bool overlay JSON accepted. Surfaces with
  no RPC namespace yet: postgame screen push (`PostGameWebController`, BasicTier-gated),
  per-phase mock toggles, match/series/team control, style sets, hotkey enable, app status.
- **Game phases**: `OutOfGame, Loading, Running, Paused, Mocking, GameOver, ChampionSelect`
  (`IngameController.cs:27-36`).
- **Entitlements**: features come exclusively from the account backend via the logged-in app
  user (`ILoginService` → process-wide `IFeatureProvider`). Enforcement hooks exist at REST
  (`[RequiresFeature]`), RPC per-method (`featureProvider.HasFeature`, `RpcException.Unauthorized`
  — precedent in `CasterRemoteRpcImpl.StartSession`), WS gates, and per-catalog-button
  `MinFeature`. No per-caller credentials locally — gating rides on the app user's entitlements.
- **Discovery**: `mdnsHostManager.cs` exists → pairs with Companion's `bonjour-device` field later.

### 2.2 Companion platform (current as of July 2026)

- `@companion-module/base` **2.1.2** / Companion **5.0.2** are current; API 1.14 (our template)
  runs on Companion **4.2+**. Store minimum is 4.0; modules are on-demand store plugins with
  independent release cycles (tag `vX.Y.Z` → developer portal → volunteer review).
- Lifecycle: `init` / `configUpdated` / `destroy` (must clear timers), status via
  `updateStatus(InstanceStatus.*, message)` — including `AuthenticationFailure` and
  `InsufficientPermissions`, the sanctioned surfaces for license problems.
- Conventions from top modules (vMix/OBS/ATEM): boolean feedbacks with `defaultStyle`; offer
  **both** toggle and explicit set actions; batch `setVariableValues`; call `checkFeedbacks`
  with specific IDs; **action/feedback/variable IDs are permanent public API** — camelCase,
  frozen from day one (upgrade scripts are the only escape hatch, and can never be removed).
- License-gated targets are fully accepted store practice (vMix, H2R Graphics, Spotify Premium).
  Recommended UX: document the tier requirement in HELP.md; `InsufficientPermissions` when
  authenticated-but-untiered; recheck on entitlement change so upgrading recovers live.

---

## 3. High-level design

### 3.1 Component diagram

```
┌────────────────────────────┐            ┌──────────────────────────────────────────────┐
│  Companion (≥4.2)          │            │  LeagueBroadcast app (port 58869)            │
│ ┌────────────────────────┐ │ FlatBuffers│ ┌──────────────────────────────────────────┐ │
│ │ companion-module-      │ │ RPC WS     │ │ /ws/rpc                                  │ │
│ │ league-broadcast       │ │ ══════════▶│ │  caster_mode.Execute / GetConfig /       │ │
│ │                        │ │            │ │    GetActiveOverlays                     │ │
│ │  main.ts (lifecycle)   │ │            │ │  caster_mode.SubscribePanelState  (NEW)  │ │
│ │  client/rpc.ts         │ │            │ │  status.Subscribe…            (NEW/opt)  │ │
│ │   (@bluebottle/rpc +   │ │            │ │  cinematics.* · settings.* · ping.*      │ │
│ │    generated stubs)    │ │            │ └──────────────────────────────────────────┘ │
│ │  client/rest.ts (thin, │ │  REST      │  Transition-only REST: /api/postgame/*,      │
│ │   transition only)     │ │ ──────────▶│  /api/{phase}/mock, /api/match/*,            │
│ │  state.ts (store)      │ │            │  /api/style/set/*  (each dropped as its      │
│ │  actions/ feedbacks/   │ │            │  RPC twin lands)                             │
│ │  variables/ presets/   │ │            │                                              │
│ └────────────────────────┘ │            │  entitlements: logged-in app user (Cognito)  │
└────────────────────────────┘            └──────────────────────────────────────────────┘
```

### 3.2 Data flow

- **Commands (Companion → app)**: `caster_mode.Execute(CasterCommandDto)` for all 13 caster
  command types — the same seam the in-app panel, remote casters, and hotkeys use. Cinematics
  via `cinematics.Arm/Go/Stop/Play`. Not-yet-migrated commands (postgame push, mock, match
  control, style sets) go through `client/rest.ts` until their RPC namespaces exist; the
  `client/` layer hides the transport per command so actions never know which stack served them.
- **State (app → Companion)**: RPC subscriptions. `caster_mode.SubscribePanelState` (new, §4)
  delivers the panel snapshot (pages, buttons + `Available`, active page, team names, game
  phase) plus active overlays; `cinematics.SubscribePlayback` already exists. Remaining state
  (postgame active component, mock flags, match summary) is polled over transition REST at a
  slow interval (5 s) until RPC twins land — acceptable because these change at human speed.
- **Handshake at init**: RPC connect (loopback → auto-`local` scope) → `ping` → version/feature
  check → `caster_mode.GetConfig` + `GetActiveOverlays` snapshot → issue subscriptions → `Ok`.
  `RpcException.Unauthorized` → `InsufficientPermissions` with an upgrade message.

### 3.3 Transport decision (rev 2)

| Option                                       | Verdict                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FlatBuffers RPC (`/ws/rpc`)**              | ✅ **Primary.** The app's strategic direction; `caster_mode.Execute` already covers all 13 command types (no new command endpoint needed at all); per-method feature gating precedent exists; the TS runtime is zero-dep, single-file, with reconnect/heartbeat/subscription-replay built in. Gaps (state push, Node polish, packaging, remote auth) are §4 — all work the RPC-only migration needs anyway. |
| REST + `/ws/ui` JSON                         | ◐ **Transition fallback only**, for surfaces without an RPC namespace yet (postgame push, mock, match, style sets). Each call is tagged for deletion as its RPC twin lands. Building the module primarily here (rev 1) would have extended the legacy stack's lifetime and required new REST endpoints on a deprecated path — rejected.                                                                     |
| npm `@bluebottle_gg/league-broadcast-client` | ◐ Reuse its generated REST clients for the transition fallbacks; grow it (or a sibling) into the published home of the RPC runtime + stubs (§4.3).                                                                                                                                                                                                                                                          |

---

## 4. LeagueBroadcast-side work (Phase 0)

All of this is "expand the RPC stack" work that the RPC-only migration wants regardless of
Companion — Companion is the first external consumer, not a special case.

### 4.1 State push: `caster_mode.SubscribePanelState`

Add an `[RpcSubscribe]` method on `caster_mode` publishing the existing `CasterPanelStateDto`
shape locally (buttons incl. `Available`, pages, activePageId, team names, `GamePhase`) plus
active overlay names. The publisher plumbing already exists — `CasterRemoteBridge.SchedulePublish`
fires on every command/config change; this subscription is its local twin. Covers ~80 % of the
module's feedbacks/variables in one message.

Optional second subscription (or fold into panel state): app status essentials
(per-phase active/mock/error, League-client failure) — today only on legacy `/ws/ui` `appStatus`.

### 4.2 Node-compatibility patches to `@bluebottle/rpc` (TS runtime)

- Guard the `document.visibilitychange` listener (`typeof document !== 'undefined'`).
- Accept an injectable WebSocket factory **or** an upgrade-headers option (Node's native
  `WebSocket` cannot set headers; the `ws` package can). Needed for remote auth (§4.4);
  loopback works with the native global today.

### 4.3 Publish the RPC client for external consumers

`@bluebottle/rpc` ships raw TS and lives inside the workspace. Publish a compiled package —
recommended: an `rpc` entry point in `@bluebottle_gg/league-broadcast-client` (runtime + the
generated stubs for `caster_mode`, `cinematics`, `settings`, `ping` + DTO types), versioned in
lockstep with app releases. The module pins a minimum app version and verifies it at handshake
(schema skew is real: generated RPC TS is known to lag `RpcTableGenerator` occasionally).

### 4.4 Remote-host auth (can ship after v1)

v1 is loopback-only (auto-`local` scope, zero config). For Companion on a separate machine
(Companion Pi is common): the server already accepts `Authorization: Bearer` pairing pre-auth at
upgrade against `RpcPairingTokenStore` — needs (a) the runtime headers option from §4.2, (b) a
"Companion pairing token" management UI in app settings (generate/revoke), (c) a `secret-text`
config field in the module. Do **not** ship the tempting alternative — forging a same-host
`Origin` header from Node — as the official path; it works (`TrustSameHostOriginPeers`) but
bypasses the credential model.

### 4.5 Gating enforcement audit (required for §7 to be real)

Verify `CasterCommandExecutor.ExecuteAsync` enforces per-button/overlay `MinFeature`
**server-side** for local-origin commands (not only via UI button disabling and remote-visibility
checks), and that legacy REST twins (`/api/ingame/showing` etc.) enforce the same while they
live. Otherwise the tier gate is bypassable with a hand-rolled client. Matters independent of
Companion. (Tracked as a separate task.)

---

## 5. Module deep dive

### 5.1 Code structure

Keep the template's file layout (Companion reviewers expect it), grow folders where a file would
bloat — the vMix module pattern:

```
companion-module-league-broadcast/
├── companion/
│   ├── manifest.json        # id: league-broadcast, runtime node22, api nodejs-ipc
│   └── HELP.md              # setup, tier requirement, action/feedback/variable reference
├── src/
│   ├── main.ts              # ModuleInstance: lifecycle, orchestration only
│   ├── config.ts            # host, port, (later: pairing token secret, bonjour-device)
│   ├── client/
│   │   ├── rpc.ts           # RpcClient wiring: connect, handshake, subscriptions,
│   │   │                    #   connection-event → InstanceStatus mapping
│   │   ├── rest.ts          # THIN transition fallback (postgame/mock/match/style);
│   │   │                    #   every function tagged with its future RPC twin
│   │   └── commands.ts      # transport-agnostic command facade used by actions.ts
│   ├── state.ts             # single store: panel state, overlays(Set), phase, mock flags,
│   │                        #   match summary, features(Set)
│   ├── actions.ts           # definitions; thin callbacks → commands.ts
│   ├── feedbacks.ts         # boolean feedbacks reading state.ts
│   ├── variables.ts         # definitions + batched updateVariables(state)
│   ├── presets.ts           # preset builders per category
│   ├── choices.ts           # dropdown builders (overlay catalog, dynamic buttons/pages)
│   └── upgrades.ts          # append-only forever
├── package.json             # @companion-module/base ~1.14.1, @bluebottle_gg/league-broadcast-client
└── docs/design.md           # this file
```

**Flow discipline**: RPC subscription messages (and slow REST polls) mutate `state.ts` → one
`setVariableValues({...})` batch → `checkFeedbacks(<only affected ids>)`. Actions never mutate
local state optimistically; the app's push confirms (single source of truth = the app).

**Dynamic definitions**: caster buttons, pages, series, and style sets are user data → dropdowns
built from `state.ts` in `choices.ts`; re-call `setActionDefinitions` **only** when the panel
config actually changes (SubscribePanelState delivers config changes), never per state tick.

### 5.2 Config fields

| Field          | Type                          | Default     | Notes                                        |
| -------------- | ----------------------------- | ----------- | -------------------------------------------- |
| `host`         | textinput (Regex.IP/hostname) | `127.0.0.1` | The broadcast PC                             |
| `port`         | number                        | `58869`     | Matches `WebAppGlobals`                      |
| `pairingToken` | secret-text                   | —           | Phase 3+, only for non-loopback hosts (§4.4) |

### 5.3 Status mapping

| Condition                                                   | InstanceStatus            | Message                                      |
| ----------------------------------------------------------- | ------------------------- | -------------------------------------------- |
| No host configured                                          | `BadConfig`               | —                                            |
| RPC `reconnecting` event / initial connect                  | `Connecting`              | —                                            |
| `reconnect-failed` / unreachable                            | `ConnectionFailure`       | "LeagueBroadcast not reachable at host:port" |
| Handshake version below minimum                             | `ConnectionFailure`       | "LeagueBroadcast X.Y+ required"              |
| Not logged in in the app                                    | `AuthenticationFailure`   | "Log in to LeagueBroadcast"                  |
| `RpcException.Unauthorized` on gated method (no Basic tier) | `InsufficientPermissions` | "Companion control requires the Basic tier"  |
| Remote host, invalid/missing pairing token                  | `AuthenticationFailure`   | "Invalid pairing token"                      |
| Connected + entitled                                        | `Ok`                      | —                                            |

Tier state is also a feedback + variable, re-evaluated on entitlement push (features change
message via `subscription` namespace, or panel-state `Available` flags) — upgrading mid-session
recovers to `Ok` without a module restart.

### 5.4 Action inventory (IDs frozen at v1)

Per best practice every stateful action ships as _set_ (`on`/`off`) **and** _toggle_ — modeled as
one action with a `mode: toggle|show|hide` dropdown to keep the list short. Transport per action
noted as ⚡ RPC (permanent) or 🕘 REST (transition fallback, swaps to RPC when the namespace lands).

> **As-built note (v0.1.0):** `overlaySet` is deferred — `toggle-overlay` addresses configured
> _button instances_ (`ButtonId`), not raw overlay types, so a raw-type action needs the legacy
> REST `showing` endpoint or a server-side extension; `seriesSelect` and `styleSetActivate` are
> also deferred (no polled source for their dynamic dropdowns yet). All three are Phase-2
> backlog. Cinematics (`cinematicArm`/`cinematicGo`/`cinematicStop`/`cinematicPlay` +
> `cinematicPlaying` feedback) shipped in v1 instead.

**Category: In-game overlays**

- `casterButtonPress` ⚡ — **the flagship action**: dropdown of the operator's configured caster
  buttons (honors their custom settings, mirrors the in-app panel) → `toggle-overlay` by `ButtonId`.
- `deactivateAll` ⚡ — panic button → `deactivate-all` (always allowed server-side).
- `pageSwitch` ⚡ — dropdown of configured caster pages → `page-switch`.

**Category: Recaps & teamfights** (all ⚡ via `caster_mode.Execute`)

- `damageRecap` — mode: `selectLatest|deselect` (+ display-mode option).
- `objectiveRecap` — mode: `selectLatest|deselect` (+ display-mode, DPS flag).
- `teamfightTrack` — mode: `start|stop`.
- `teamfightOverlay` — mode: `selectLatest|deselect`.
- `championDetailPin` — player slot 0–9 dropdown (blue 0–4 / red 5–9).

**Category: Post-game**

- `postgameShow` ⚡/🕘 — the six default postgame buttons map to `postgame-show` via
  `caster_mode.Execute` ⚡; arbitrary component/scope/game-id pushes use
  `POST /api/postgame/active/...` 🕘.
- `postgameClear` 🕘 — `DELETE /api/postgame/active-component`.

**Category: Rehearsal (mock)**

- `mockSet` 🕘 — phase dropdown (pregame/ingame/postgame) + mode on/off/toggle →
  `POST /api/{phase}/mock/{bool}`.

**Category: Series & match control** (all 🕘)

- `seriesSelect` — dynamic dropdown of series → `POST /api/match/current/{seriesid}`.
- `setBestOf` — 1/3/5 → `PUT /api/match/current/bestof`.
- `setGameWinner` — team dropdown → `PUT /api/game/.../winner/...`.
- `swapSides` — `POST /api/match/current/{seriesid}/switch`.

**Category: System**

- `hotkeysSet` 🕘 (likely `settings.*` ⚡ soon) — on/off/toggle (lets the deck _replace_ keyboard
  hotkeys and avoid double-fires).
- `styleSetActivate` 🕘 — phase + dynamic style-set dropdown.
- `cinematicPlay` ⚡ — `cinematics.Play(id)` / `PlayRelative`; `cinematicArm`/`cinematicGo`/
  `cinematicStop` ⚡ — the full cinematics transport is already RPC, so rev 2 **upgrades**
  cinematics from "deferred" to v1-capable, including `cinematics.SubscribePlayback` feedback.

### 5.5 Feedbacks (all boolean)

| ID                        | True when                                 | Driven by                                  |
| ------------------------- | ----------------------------------------- | ------------------------------------------ |
| `overlayActive`           | selected overlay type visible             | panel-state subscription (active overlays) |
| `casterButtonActive`      | selected configured button's overlay live | same + button→overlay mapping              |
| `casterPageActive`        | selected page is active                   | panel-state `activePageId`                 |
| `gamePhaseIs`             | phase == option (7-value dropdown)        | panel-state `GamePhase`                    |
| `mockActive`              | selected phase mocked                     | REST poll 🕘                               |
| `teamfightTracking`       | tracker running                           | panel state / executor result              |
| `postgameComponentActive` | selected component showing                | REST poll 🕘                               |
| `hotkeysEnabled`          | keyboard hotkeys on                       | REST poll 🕘                               |
| `tierEntitled`            | Basic tier present                        | entitlement push / panel-state `Available` |
| `leagueConnected`         | ingame source live, no failure            | app-status subscription (§4.1) or 🕘       |
| `cinematicPlaying`        | playback active                           | `cinematics.SubscribePlayback` ⚡          |

Default styles: green bg for "live/active", red for panic/error states, amber for mock.

### 5.6 Variables

`gamePhase`, `blueTeamName`, `redTeamName`, `blueScore`, `redScore`, `bestOf`, `activePage`,
`activeOverlayCount`, `postgameComponent`, `tier`, `appVersion`, `leagueStatus`. Live-game data
(`gameTime`, dragons, gold) is **deferred** until a suitable RPC subscription exists — the legacy
`/ws/in` full-snapshot stream is exactly the stack being retired, and subscribing to it from the
module would contradict the transport decision. All updates flow through one batched
`setVariableValues` per event.

### 5.7 Presets

Categories mirror the broadcast run-of-show so a new user can drag a whole page per phase:

1. **Setup & Rehearsal** — mock toggles per phase, hotkeys on/off, style-set switch.
2. **Champ Select** — mock, phase feedback status tile.
3. **Live: Overlays** — one button per catalog overlay (toggle + `overlayActive` feedback),
   plus **DEACTIVATE ALL** in red.
4. **Live: Recaps** — latest damage / objective / teamfight select+deselect pairs,
   teamfight track start/stop, champion-detail pins 1–10.
5. **Cinematics** — arm/go/stop, random-group play, playing feedback.
6. **Post-Game** — the six default postgame buttons + clear.
7. **Series Control** — best-of, swap sides, set winner.
8. **Status** — text-only tiles: `$(lb:gamePhase)`, score line
   `$(lb:blueTeamName) $(lb:blueScore)–$(lb:redScore) $(lb:redTeamName)`.

### 5.8 Versioning & platform choice

- **Stay on base ~1.14.1 / API 1.14 (Companion 4.2+) for v1.** Companion 5.0 is two weeks old;
  the production install base is 4.x. Migrate to base 2.x as a minor release once 5.x adoption
  is broad — frozen IDs make that cheap.
- Manifest: `id: league-broadcast`, repo `bitfocus/companion-module-league-broadcast` (fork
  workflow), keywords `league of legends, esports, broadcast, overlay, graphics`.
- Release: `yarn companion-module-build` → tag → developer-portal submission. Before store
  approval, distribute the `.tgz` from our own releases page — side-loading is officially
  supported, good for a beta with existing customers.
- **Version coupling**: the module pins a minimum LeagueBroadcast version (handshake-checked)
  because RPC schemas evolve with the app. FlatBuffers optional-field evolution keeps older
  modules working against newer apps; the reverse (new module, old app) fails the handshake
  with a clear "update LeagueBroadcast" message.

---

## 6. Reliability

- **Reconnect**: provided by the RPC runtime — exponential backoff + jitter, heartbeat with
  forced-close on timeout, and **automatic re-issue of every subscription channel** on
  reconnect. Module maps connection events to InstanceStatus (§5.3) and re-runs the handshake
  - snapshot fetch on `connected`. `destroy()` closes the client and clears any REST poll timer.
- **App restart mid-show**: reconnect → handshake → fresh `GetConfig`/`GetActiveOverlays` →
  subscriptions re-established by the runtime → rebuild variables + `checkAllFeedbacks`.
- **Partial degradation**: if a transition REST poll fails while RPC lives, the affected
  feedbacks/variables freeze (marked `-`) while all ⚡ controls keep working.
- **Double-command safety**: all caster commands are idempotent toggles/sets at the executor
  seam; `Execute` returns `{Ok, Error}` — failures are logged, never retried blindly.
- **Monitoring**: module `log('info'|'error')` lines for every command failure.

---

## 7. Tier gating & monetization

### 7.1 Recommended model: free module, Basic-tier server gate

- The **module** is free, MIT, in the official store (hard store requirement, and maximum
  discoverability — the store listing is marketing).
- The **server** enforces tier on the RPC methods (feature check in the impl, precedent:
  `CasterRemoteRpcImpl.StartSession`), on the logged-in app user's entitlements from the
  account backend — nothing for the module to validate, nothing spoofable client-side, no new
  key infrastructure.
- Module UX on gate: `InsufficientPermissions` + "Companion control requires the LeagueBroadcast
  Basic tier — upgrade in the app", HELP.md states it up front, `tierEntitled` feedback lets
  users build a visible "upgrade needed" tile. Recovers live on entitlement push.

### 7.2 Gating granularity — decision needed

| Option                                                                                                                                      | Pros                                                                                                                                                                                                                                                                            | Cons                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Hard gate** — `caster_mode.Execute`/`SubscribePanelState` require BasicTier wholesale                                                  | Simplest story: "Companion support is a Basic feature".                                                                                                                                                                                                                         | Free users get zero taste; the in-app panel and the RPC surface then disagree about what free users may do.                                                         |
| **B. Mirror the app (recommended)** — commands enforce the catalog's per-button `MinFeature` at the executor seam; postgame stays BasicTier | Exactly matches in-app behavior (free overlays: Scoreboard, Inhibitors, pit timers, Twitch). Free users experience the module → natural upsell; premium commands return `Unauthorized` with upgrade message. No path (UI, hotkey, RPC, Companion) disagrees about what's gated. | Slightly more nuanced marketing message; needs the §4.5 enforcement audit either way.                                                                               |
| C. New `Feature.CompanionControl` entitlement                                                                                               | Sellable as an add-on independent of tier.                                                                                                                                                                                                                                      | New SKU + backend/account work; fragments the tier story; for a €29.95/mo Basic tier, Companion is better used as retention/upsell value than a separate line item. |

Recommendation: **B**, with the marketing line "full Stream Deck control with Basic". If the
business wants a separate paid add-on later, option C layers on cleanly.

### 7.3 Should the utility itself cost money?

No — charging for the module directly is blocked for store distribution and unprecedented in the
ecosystem. The value capture is: Companion support drives Basic-tier subscriptions (and is a
strong differentiator — no other LoL overlay tool ships an official Companion module).

---

## 8. Trade-offs & decisions (summary)

| Decision                 | Choice                                                                                    | Trade-off accepted                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Transport                | **FlatBuffers RPC first**; thin REST fallbacks only for not-yet-migrated surfaces         | Phase 0 server work (subscription, runtime patches, packaging) before module MVP; binary protocol is harder to debug than curl-able REST |
| Command path             | `caster_mode.Execute` (exists today)                                                      | None — this is the sanctioned seam                                                                                                       |
| State push               | New `caster_mode.SubscribePanelState` (reuses `CasterPanelStateDto` + existing publisher) | Server change required; interim REST polls for postgame/mock/match state                                                                 |
| RPC client               | Patch + publish `@bluebottle/rpc` runtime + stubs via npm                                 | Coupling to our own npm release cadence; schema-skew risk mitigated by handshake version pin                                             |
| Remote hosts             | Loopback-only v1; Bearer pairing tokens later (§4.4)                                      | Companion-on-separate-machine users wait one release                                                                                     |
| base version             | ~1.14 (Companion 4.2+)                                                                    | No typed schemas / template presets until 2.x migration                                                                                  |
| Gating                   | Server-side, mirror in-app `MinFeature` (option B)                                        | Needs the §4.5 enforcement audit                                                                                                         |
| Monetization             | Free module, tier-gated app features                                                      | No direct module revenue                                                                                                                 |
| Button model             | Prefer operator's configured caster buttons over raw overlay types (both offered)         | Dynamic dropdowns → definitions rebuild on config change                                                                                 |
| Live game-data variables | Deferred until an RPC subscription exists                                                 | No game clock on buttons in v1                                                                                                           |

## 9. Roadmap

- **Phase 0 — LeagueBroadcast enablement** ✅ **done** (uncommitted on `develop`, pending user
  review): `caster_mode.SubscribeLocalPanelState` (§4.1) with shared builder seam + dispatcher
  test; TS runtime needed no patches (§4.2); client is vendored for now, npm publish still
  open (§4.3); `MinFeature` enforcement landed via the parallel audit session (§4.5).
- **Phase 1 — Module v0.1.0** ✅ **done**: full scaffold + real transport + cinematics +
  presets + HELP; packaged `league-broadcast-0.1.0.tgz` via companion-module-build. Ready for
  side-load pilot once integration-tested against a live app.
- **Phase 2 — Full surface + store**: `overlaySet` (raw overlay types), `seriesSelect`,
  `styleSetActivate`, HELP.md screenshots, live-app integration test, npm-published RPC client
  replacing the vendored copy, store submission.
- **Phase 3 — Polish & de-legacy**: remote-host pairing tokens (§4.4), mDNS auto-discovery
  (`bonjour-device`), swap each 🕘 REST fallback to its RPC twin as namespaces land, live
  game-data variables once an RPC game-state subscription exists, base 2.x migration when
  Companion 5 adoption justifies it.

## 10. What to revisit as it grows

- **New RPC namespaces** (postgame, match, app status): each one shipped in the app retires a
  🕘 fallback here — keep `client/rest.ts` shrinking; it hitting zero is the "migration done"
  signal for this module.
- **Remote-caster parity**: the Broadcast Server relay (`caster.SendCommand`) could someday let
  a _remote_ Companion drive a host across the internet — same command DTOs, different auth
  (room-based), explicitly out of scope for v1.
- **Multiple app instances** (Interface + Coaching + Minion each embed a server): v1 assumes one
  connection per module instance; multi-instance users add more connections in Companion.
- **Companion base 2.x**: template groups would generate the per-overlay preset wall much more
  cheaply; revisit at migration time.
