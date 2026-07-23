# companion-module-league-broadcast

Bitfocus Companion module for [LeagueBroadcast](https://bluebottle.gg) — Stream Deck / surface
control over League of Legends broadcast overlays: in-game overlay toggles, caster pages, recaps,
post-game stat screens, rehearsal (mock) data, and a panic hide-all button.

- User documentation: [companion/HELP.md](./companion/HELP.md)
- System design: [docs/design.md](./docs/design.md)
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
done with `yarn package` (companion-module-build).
