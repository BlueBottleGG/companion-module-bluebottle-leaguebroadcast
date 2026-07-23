# LeagueBroadcast

Control [LeagueBroadcast](https://bluebottle.gg) League of Legends broadcast overlays from a
Companion surface: toggle in-game overlays, switch caster pages, drive damage/objective/teamfight
recaps, pin champion details, push post-game stat screens, control rehearsal (mock) data, and keep
a panic "hide everything" button under your finger.

## Requirements

- **LeagueBroadcast running on the same machine as Companion.** v1 connects to the local machine
  only (loopback). Support for a separate Companion host (e.g. a Companion Pi) is planned for a
  later release.
- **Logged in to LeagueBroadcast.** The module rides on the entitlements of the logged-in app user.
- **Basic tier for most overlays.** The free tier can control Scoreboard, Inhibitors, the Baron and
  Dragon pit timers, and the Twitch overlays. Everything else — including the post-game stat
  screens — requires the LeagueBroadcast **Basic** tier. Gating is enforced by the app itself; the
  module shows a clear status message when a command is blocked.

## Configuration

| Setting | Default     | Notes                                                                        |
| ------- | ----------- | ---------------------------------------------------------------------------- |
| Host    | `127.0.0.1` | Keep the default in v1 — only the local machine is supported.                |
| Port    | `58869`     | The LeagueBroadcast local API port. Only change if you reconfigured the app. |

## Actions

| Action                            | What it does                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Caster Button: Press              | Toggle/show/hide one of **your** configured caster panel buttons (dropdown mirrors the in-app panel).                |
| Caster Page: Switch               | Switch the active caster page.                                                                                       |
| Deactivate All Overlays           | Panic button — hides every active overlay.                                                                           |
| Damage Recap                      | Select the latest damage recap, or deselect it.                                                                      |
| Objective Recap                   | Select the latest objective recap (optionally the DPS view), or deselect it.                                         |
| Teamfight Tracking                | Start/stop teamfight tracking.                                                                                       |
| Teamfight Overlay                 | Select the latest teamfight overlay, or deselect it.                                                                 |
| Champion Detail: Pin Player       | Pin the champion detail view to a player (Blue 1–5, Red 1–5).                                                        |
| Post-Game: Show Configured Button | Trigger one of the postgame buttons configured in the app.                                                           |
| Post-Game: Show Component         | Push a post-game component directly (game/player/matchup/fearless-bans/player-stats) with current/team/player scope. |
| Post-Game: Clear Component        | Clear the active post-game component.                                                                                |
| Cinematic: Arm                    | Arm a cinematic by ID — loaded and paused at its start, ready for an instant Go.                                     |
| Cinematic: Go                     | Start the armed cinematic.                                                                                           |
| Cinematic: Stop                   | Stop cinematic playback and tear it down.                                                                            |
| Cinematic: Play                   | Play a cinematic by ID immediately (Arm + Go in one step).                                                           |
| Mock Data: Set                    | Turn rehearsal (mock) data on/off per phase (pre-game/in-game/post-game).                                            |
| Series: Set Best-Of               | Set the current series to Bo1/Bo3/Bo5.                                                                               |
| Series: Swap Sides                | Swap sides for a series (series ID text input, supports variables).                                                  |
| Keyboard Hotkeys: Set             | Enable/disable the app's keyboard hotkeys (turn them off when the deck replaces them).                               |

## Feedbacks

All feedbacks are boolean and can restyle the button when true.

| Feedback                     | True when                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Overlay Active               | The selected overlay type is currently visible.                                                            |
| Caster Button Active         | The selected configured caster button's overlay is live.                                                   |
| Caster Page Active           | The selected caster page is active.                                                                        |
| Game Phase Is                | The game phase matches (out of game / loading / in game / paused / mocking / game over / champion select). |
| Mock Data Active             | Mock data for the selected phase is on.                                                                    |
| Post-Game Component Active   | The selected post-game component is showing.                                                               |
| Keyboard Hotkeys Enabled     | The app's keyboard hotkeys are enabled.                                                                    |
| Tier Entitled                | The required tier is present (invert it for a warning tile).                                               |
| Cinematic Playing            | A cinematic is currently playing.                                                                          |
| Connected to LeagueBroadcast | The module's live connection to the app is up.                                                             |

## Variables

| Variable                                 | Contents                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `$(league-broadcast:gamePhase)`          | `outofgame` / `loading` / `ingame` / `paused` / `mocking` / `gameover` / `champselect` (`none` until the first update) |
| `$(league-broadcast:blueTeamName)`       | Blue team name                                                                                                         |
| `$(league-broadcast:redTeamName)`        | Red team name                                                                                                          |
| `$(league-broadcast:activePage)`         | Active caster page name                                                                                                |
| `$(league-broadcast:activeOverlayCount)` | Number of active overlays                                                                                              |
| `$(league-broadcast:postgameComponent)`  | Active post-game component (empty when none)                                                                           |
| `$(league-broadcast:hotkeysEnabled)`     | `on` / `off`                                                                                                           |
| `$(league-broadcast:tier)`               | `ok` / `blocked`                                                                                                       |
| `$(league-broadcast:appVersion)`         | LeagueBroadcast version                                                                                                |
| `$(league-broadcast:connectionState)`    | Connection state                                                                                                       |

## Presets

Presets are organized by broadcast phase so you can drag a whole page at a time:

1. **Setup & Rehearsal** — mock-data toggles per phase (amber when active) and a keyboard-hotkeys
   on/off pair.
2. **Live: Overlays** — ready-made tiles for the six most common overlays (Scoreboard, Gold Graph,
   Runes, Baron Timer, Dragon Timer, Inhibitors) plus a red **HIDE ALL** panic button.
   **After dragging an overlay preset, open its Caster Button: Press action and pick your own
   configured caster button** — the button layout is yours, so the module can't guess which button
   drives which overlay. The active-state feedback is already wired to the overlay type.
3. **Live: Recaps** — damage/objective/teamfight recap select+deselect pairs, teamfight tracking
   start/stop, and champion-detail pins for all ten players.
4. **Post-Game** — one tile per post-game component plus a clear button.
5. **Cinematics** — Arm / Go / Stop tiles (fill in your cinematic ID in the Arm action) and a
   playing-status tile (green while a cinematic is live).
6. **Status** — game-phase and team-name text tiles, a connection tile (green when connected), and
   a tier warning tile (red when the Basic tier is missing).

## Troubleshooting

| Instance status                                                                         | Meaning                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OK                                                                                      | Connected and entitled.                                                                                                                                                                            |
| Connecting                                                                              | Waiting for LeagueBroadcast (initial connect or reconnect in progress).                                                                                                                            |
| Connection Failure                                                                      | LeagueBroadcast has not been reachable at the configured host:port for several reconnect attempts — is the app running? The module keeps retrying and recovers automatically once the app is back. |
| Disconnected                                                                            | The connection dropped; the module reconnects automatically.                                                                                                                                       |
| Authentication Failure with "Companion control requires the LeagueBroadcast Basic tier" | The logged-in app user does not have the Basic tier. Upgrade in the app — the module recovers automatically, no restart needed.                                                                    |
| Bad Configuration                                                                       | No host configured.                                                                                                                                                                                |

- Overlay/recap buttons doing nothing while status is OK: check the app is in the right phase
  (e.g. post-game screens need a finished or mocked game).
- Both a keyboard hotkey and a Stream Deck button firing: disable the app's keyboard hotkeys with
  the **Keyboard Hotkeys: Set** action.
