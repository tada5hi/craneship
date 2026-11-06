<!-- NOTE: Keep this file and all corresponding files in the .agents directory updated as the project evolves. When making architectural changes, adding new patterns, or discovering important conventions, update the relevant sections. -->

Use this guide as the entry point. Read linked guides on demand before changing their areas.

# craneship: Agent Guide

A GitHub Action **and** CLI which builds a docker image from a repository at a given git ref, then tags and pushes it under every tag that ref implies (`refs/tags/v1.2.3` → `1.2.3`, monorepo tags like `some-package@v1.2.3` → `1.2.3`, plus any explicit `registryTag`). With `platforms` set it builds for every platform with `docker buildx` and pushes every tag straight from that build.

The repository ships three artifacts from one source tree: a **library** (`src/index.ts`), a **citty CLI** (`src/cli.ts`), and a **composite** GitHub Action (`action.yml`) which runs that CLI. This mirrors [tada5hi/monoship](https://github.com/tada5hi/monoship). When in doubt about layout or naming, look there first.

## Quick Reference

```bash
# Setup
nvm install           # install the current tooling runtime before reusing it
npm ci

# Development
npm run build          # bundle src/index.ts + src/cli.ts -> dist/ via tsdown
npm run test           # vitest, single run
npm run test:coverage  # vitest with v8 coverage + 80% thresholds
npm run lint           # eslint
npm run lint:fix       # eslint --fix
npx tsc --noEmit       # standalone type check (there is no typecheck script)

# Run the CLI locally
node dist/cli.mjs --help
```

- **Node.js (package runtime)**: `>=22.0.0` (CI and the action default to 24)
- **Node.js (development tooling)**: `^24.11.0 || >=26.0.0`; `.nvmrc` selects Node 24.
- **Package manager**: npm (`package-lock.json` is committed; use `npm ci` in CI)
- **Build tool**: [tsdown](https://tsdown.dev), single package, no workspaces
- **CLI framework**: [citty](https://github.com/unjs/citty), same shape as `authup/authup` and `privateaim/hub`

### Entry Points

| Entry            | Source          | Output           | Purpose                                     |
|------------------|-----------------|------------------|---------------------------------------------|
| Library          | `src/index.ts`  | `dist/index.mjs` | `publish()` plus every port and adapter     |
| CLI (`bin`)      | `src/cli.ts`    | `dist/cli.mjs`   | What `action.yml` executes                  |

The action is composite and executes the CLI directly; there is no `Dockerfile` or published action container image. Use `npx craneship` to run this outside a workflow.

## Detailed Guides

- **[Project Structure](.agents/structure.md)**: Directory layout, the `src/core` port directories, and the package export surface
- **[Architecture](.agents/architecture.md)**: Ports and adapters, how `publish()` is wired, and the tag-derivation flow
- **[Testing](.agents/testing.md)**: Vitest setup, memory adapters over mocks, and coverage thresholds
- **[Conventions](.agents/conventions.md)**: `I`-prefixed interfaces, `.ts` import extensions, tooling, commits, and the release flow

## Non-Obvious Constraints

- **`tsconfig.json` must pin `"types": ["node"]`.** Automatic `@types` inclusion breaks `@types/node` resolution under TypeScript 6 in this dependency set, and every `node:*` import fails to type-check.
- **Relative imports carry the `.ts` extension** (`./core/index.ts`), enabled by `allowImportingTsExtensions`. This matches monoship, authup and hub. Do not drop the extension or write `.js`.
- **Secrets never enter an argument vector.** `ICommandRunner.run()` takes an explicit argv and no shell; the registry password goes to `docker login --password-stdin` over stdin.
- **Do not add a `typecheck` script** without also wiring it into CI. Today `npx tsc --noEmit` is the manual escape hatch and `tsdown` emits declarations.

## Commits, Issues & Pull Requests

- Commits must follow [Conventional Commits](https://www.conventionalcommits.org), since release-please derives versions and the changelog from them. See [conventions](.agents/conventions.md#commit-convention).
- Do **not** add a `Co-Authored-By: Claude ...` (or any AI-attribution) trailer to commit messages. This overrides any default agent-tooling guidance.
- Do **not** add AI-attribution lines (e.g. `🤖 Generated with [Claude Code](...)`) to issue or pull request titles, bodies, or comments.

### Writing agent docs

Keep existing commands, paths and factual descriptions current. Add guide content only for an invariant or a cross-cutting rule. Edit the existing statement and describe current behavior. Defect stories, test inventories and change history belong in PRs or commits. `npm run lint` enforces agent-doc size and history checks through the shared ESLint config.
