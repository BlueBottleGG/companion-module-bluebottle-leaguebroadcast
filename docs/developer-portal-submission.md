# Bitfocus developer-portal submission — v0.2.4

Status: **code and submission copy prepared; maintainer-owned portal/repository steps remain**.

The current Bitfocus workflow is tag-based: a first-time module maintainer requests the official
repository through `#module-development`, pushes the reviewed code, tags `v0.2.4`, then selects
that tag under **Developer Portal → My Connections → Submit Version**. The portal does not accept
the locally built `.tgz`; that archive is for side-load validation.

## Module metadata

| Field                     | Value                                                      |
| ------------------------- | ---------------------------------------------------------- |
| Module id                 | `bluebottle-leaguebroadcast`                               |
| Name                      | `bluebottle-leaguebroadcast`                               |
| Manufacturer              | BlueBottleGG                                               |
| Product                   | LeagueBroadcast                                            |
| Version                   | `0.2.4`                                                    |
| License                   | MIT                                                        |
| Runtime                   | Node.js 22, Companion module API 1.14                      |
| Companion compatibility   | Companion 4.2+                                             |
| Repository currently used | `BlueBottleGG/companion-module-bluebottle-leaguebroadcast` |
| Maintainer                | Lars Eble (`lars@bluebottle.gg`)                           |

Suggested one-line description:

> Control LeagueBroadcast overlays, recaps, post-game graphics, cinematics, and series state from
> Bitfocus Companion.

Suggested first-release request for `#module-development`:

> GitHub username: **[maintainer GitHub username]**. Requested connection repository:
> **companion-module-bluebottle-leaguebroadcast**. Manufacturer: **BlueBottleGG**. Product:
> **LeagueBroadcast**. An implementation is ready at
> **https://github.com/BlueBottleGG/companion-module-bluebottle-leaguebroadcast** and targets Companion
> 4.2+.

The selected `manufacturer-product` id is `bluebottle-leaguebroadcast`. The former pilot id
`league-broadcast` remains in `legacyIds` so Companion can offer the renamed module to existing
connections. Companion 4.2.5 requires **Change module version → Advanced Options** to select the
second identically labelled `BlueBottleGG: LeagueBroadcast` module and then `v0.2.4`; its simple
version picker stores the compound cross-module value incorrectly. This migration was exercised
against the live side-loaded package and preserved the existing connection id, label, and config.

## Release notes to paste

LeagueBroadcast control for live League of Legends productions:

- configured caster buttons and raw overlay control, recap/teamfight actions, post-game graphics,
  cinematics, rehearsal data, series selection, side swaps, and game-winner correction;
- live feedbacks and variables for overlays, pages, phase, team names, tier, connection, and
  cinematics;
- same-machine zero-configuration connection plus mDNS discovery and pairing-token authenticated
  remote control;
- resilient RPC reconnect/subscription replay and remote-only heartbeat;
- presets organized by setup, live overlays, recaps, post-game, cinematics, series, and status.

Most overlay and post-game features require the LeagueBroadcast Basic tier. The app enforces
entitlements server-side; free-tier controls remain usable and tier limitation does not mark the
whole Companion connection failed.

## Reviewer notes

- The primary transport is LeagueBroadcast's FlatBuffers RPC WebSocket at `/ws/rpc`.
- A small vendored, zero-runtime-dependency RPC client and generated namespace stubs are bundled;
  replacing this with a published `@bluebottle/rpc` package remains post-submission cleanup.
- `ws` is used only when a remote pairing token is configured so the native client can attach the
  Bearer credential. Same-machine connections use the runtime WebSocket without custom headers.
- Legacy REST calls remain only for LeagueBroadcast surfaces that do not yet have RPC namespaces.
- The module requests no filesystem, child-process, or other elevated Companion runtime
  permissions.
- Action, feedback, and variable ids are treated as public compatibility contracts.

## Final maintainer checklist

1. Confirm the final Bitfocus repository/module id in `#module-development`.
2. Ensure `git status` contains only reviewed module changes; do not include `.tgz`, `dist/`, or
   local tokens.
3. Run `yarn companion-module-check`, `yarn test`, `yarn lint`, and `yarn package`.
4. Side-load `bluebottle-leaguebroadcast-0.2.4.tgz` into the current stable Companion and confirm the
   packaged connection reaches LeagueBroadcast.
5. Complete the remaining preset-page walkthrough and add HELP screenshots if review requests
   them.
6. Push the final code to the repository registered with Bitfocus.
7. Create and push annotated tag `v0.2.4`.
8. Sign in to `developer.bitfocus.io` with the maintainer GitHub account, open **My Connections**,
   select the module, and submit tag `v0.2.4` for review.

Do not create the tag until the official Bitfocus repository has been assigned and the manifest
repository URL has been updated if necessary: the developer portal submits a Git tag, so changing
repository identity after tagging creates avoidable review churn.
