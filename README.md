# companion-module-bluebottle-leaguebroadcast

Bitfocus Companion module for [LeagueBroadcast](https://bluebottle.gg) — Stream Deck / surface
control over League of Legends broadcast overlays: in-game overlay toggles, caster pages, recaps,
post-game stat screens, rehearsal (mock) data, series/winner control, and a panic hide-all button.
It supports same-machine zero-configuration use, mDNS discovery, and pairing-token authenticated
control from a remote Companion host.

- User documentation: [companion/HELP.md](./companion/HELP.md)
- Release history: [CHANGELOG.md](./CHANGELOG.md)
- System design: [docs/design.md](./docs/design.md)
- Developer-portal checklist: [docs/developer-portal-submission.md](./docs/developer-portal-submission.md)
- License: [MIT](./LICENSE)

## Development setup

Requires Node.js ≥ 22.20 and Yarn 4 (via corepack):

```sh
npm install -g corepack   # if corepack is not installed
corepack enable
yarn                      # install dependencies
yarn build                # compile once (dist/)
yarn dev                  # compile in watch mode
yarn lint                 # eslint
```

The module targets `@companion-module/base` 1.14 (Companion 4.2+). Packaging for distribution is
done with `yarn package` (`companion-module-build`). Validate the manifest and package metadata
with `yarn companion-module-check` before tagging a release.
