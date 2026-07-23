# Changelog

## 0.2.4 — 2026-07-23

- Rename the public module id to `bluebottle-leaguebroadcast`, retaining `league-broadcast` as a
  legacy id for pilot configuration migration.
- Use the port advertised by fixed LeagueBroadcast mDNS announcements, including custom app ports.
- Preserve compatibility with older app builds that incorrectly advertised port 80 by falling
  back to the configured port.
- Add current Companion connection-module metadata and correct the MIT license attribution.
- Document and test the upstream RPC framework fix that authenticates native Bearer clients
  without requiring a synthetic Origin header.

## 0.2.3 — 2026-07-23

- Add blue-team, red-team, and clear game-winner actions and presets.
- Resolve the winning team from the current side order when the action runs.
- Disable the RPC application heartbeat for loopback connections while retaining it for remote
  connections.
- Parse LeagueBroadcast's structured semantic-version response.
- Expand real HTTP and RPC regression coverage.

## 0.2.0 — 2026-07-23

- Add authenticated remote-host support with pairing tokens.
- Add mDNS discovery, full overlay/series/style-set actions, variables, feedbacks, and presets.
- Add mock RPC-server integration tests.

## 0.1.0 — 2026-07-23

- Initial side-load release with RPC caster control, cinematics, REST transition fallbacks,
  variables, feedbacks, presets, and operator help.
