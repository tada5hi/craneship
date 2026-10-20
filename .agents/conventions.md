# Conventions

## Interfaces and Implementations

**Declare a contract as an `I`-prefixed interface whenever a class is a port another implementation could stand in for.**

```typescript
// src/core/logger/types.ts
export interface ILogger {
    debug(message: string) : void;
    info(message: string) : void;
    warn(message: string) : void;
    error(message: string | Error) : void;
}

// src/core/logger/consola.ts
export class ConsolaLogger implements ILogger { … }

// src/core/logger/noop.ts
export class NoopLogger implements ILogger { … }
```

The interface is what makes the implementation replaceable: tests inject a memory adapter instead of touching a docker daemon, a registry or the filesystem. Without the named contract there is nothing for a fake to satisfy.

Rules:

- The interface name is the concept (`ILogger`), the class name is the *how* (`ConsolaLogger`, `NoopLogger`, `DockerCLIClient`, `MemoryDockerClient`). Never `LoggerImpl`.
- Each port lives in its own directory under `src/core/` with `types.ts` (the interface), one or more real adapters, and `memory.ts` (the fake), all re-exported from `index.ts`.
- Every port ships a memory implementation. A port without a fake is an untestable port.
- Consumers depend on the interface. `src/module.ts` imports only from `types.ts` files, never a concrete adapter.
- Adapters take their own dependencies as constructor arguments (`DockerCLIClient(runner)`), so they compose and stay swappable.

Plain data shapes stay `type` aliases without a prefix (`Options`, `PublishResult`, `CommandOptions`). The `I` prefix marks behavior contracts, not records.

## Tooling

| Tool                 | Purpose                                                                     |
|----------------------|-----------------------------------------------------------------------------|
| tsdown               | Bundles `src/index.ts` and `src/cli.ts` → `dist/` (ESM + `.d.mts` + sourcemaps) |
| TypeScript           | Type checking only (`noEmit: true`); base config from `@tada5hi/tsconfig`     |
| ESLint (flat config) | Linting via `@tada5hi/eslint-config`; `dist/**` ignored                       |
| Vitest               | Test runner and v8 coverage, see [testing](testing.md)                       |
| citty                | CLI argument parsing                                                          |
| commitlint           | Conventional Commits enforcement via `@tada5hi/commitlint-config`             |
| husky                | Sets `core.hooksPath`; installed by the `prepare` script                      |
| release-please       | Version bump, changelog, and release PR on `master`                           |
| monoship             | Publishes the package to npm from the release workflow                        |
| Dependabot           | Daily npm + GitHub Actions updates, grouped by prod/dev × major/minor+patch   |

The `@tada5hi/*` config packages are the source of truth for style, TS and commit rules. The local config files are thin wrappers, so **change the shared package, not the local override**, unless the deviation is genuinely project-specific.

## Workflow

- After making changes, **always run `npm run build` and `npm run lint`**, plus `npm run test` when behavior changed.
- `npm run lint:fix` auto-fixes most style violations, so run it before hand-editing formatting. The `@stylistic/object-curly-newline` and `@stylistic/exp-list-style` rules reformat multi-property literals and import lists aggressively; let the fixer decide.
- Never edit `dist/`, it is generated and git-ignored.
- Never hand-edit `.release-please-manifest.json` or the version in `package.json`; release-please owns both.
- New runtime dependencies need justification; the package ships four (`citty`, `consola`, `md5`, `semver`).

## Code Style

- **Module format**: ESM only (`"type": "module"`). Use `import`/`export`; no `require`, no `__dirname`.
- **Import extensions**: relative imports carry the **`.ts`** extension, as in `import { publish } from './module.ts'`. This is enabled by `allowImportingTsExtensions` and matches `tada5hi/monoship`, `authup/authup` and `privateaim/hub`. Do not drop it and do not write `.js`.
- **Node builtins**: always the `node:` specifier (`node:path`, `node:child_process`, `node:process`).
- **Indentation**: 4 spaces (`.editorconfig`), including JSON, YAML and TS.
- **Line endings**: LF; UTF-8; trailing whitespace trimmed; final newline required.
- **Semicolons**: required; **quotes**: single. Both are enforced by `@tada5hi/eslint-config`.
- **Return types**: written with a space before the colon, as in `function f() : string`, `readonly args : string[]`. Match the surrounding files.
- Every source file opens with the project copyright header.

## Prose Style

**Do not use the em dash (`—`).** This applies everywhere: README, the guides in `.agents/`, code comments, commit messages, issue and pull request bodies, and release notes.

Rewrite instead of substituting a hyphen. Which replacement is right depends on what the dash was doing:

| Instead of                              | Write                                    |
|-----------------------------------------|------------------------------------------|
| `Never edit dist/ — it is generated`    | `Never edit dist/, it is generated`       |
| `Thresholds are enforced — the command fails` | `Thresholds are enforced, so the command fails` |
| `# Project — Agent Guide`               | `# Project: Agent Guide`                  |
| `**[Testing](testing.md)** — Vitest setup` | `**[Testing](testing.md)**: Vitest setup` |
| `Every side effect — a, b, c — sits behind` | `Every side effect (a, b, c) sits behind` |
| `caught by a spec — do not simplify`    | `caught by a spec. Do not simplify`       |

A colon introduces or expands, a comma joins loosely, `so`/`since` makes the causal link explicit, parentheses enclose an aside, and a full stop separates two independent thoughts. Pick the one that says what the dash was implying.

Hyphens in compound words (`in-memory`, `git-ignored`) and en dashes in ranges are unaffected.

## File Organization

- `src/index.ts` is the public library barrel; `src/cli.ts` is the executable entry. Anything not reachable from one of them never ships.
- New implementation modules are `kebab-case.ts`, re-exported from the nearest `index.ts`.
- Ports go under `src/core/<name>/`; pure helpers go under `src/utils/`.
- `src/utils/` must not import from `src/core/`, so it stays dependency-free and trivially testable.
- Exported types belong in a `types.ts` next to the implementation, re-exported through the nearest barrel.

## TypeScript

- Extends `@tada5hi/tsconfig`; local overrides: `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `noEmit: true`, `allowImportingTsExtensions: true`, `types: ["node"]`.
- **`types: ["node"]` is load-bearing.** Automatic `@types` inclusion breaks `@types/node` resolution under TypeScript 6 with this dependency set, and every `node:*` import fails to resolve. Do not remove it; add to the array if another global type package is needed.
- The shared config is strict, including `noUncheckedIndexedAccess` and `noUnusedParameters`. Index access yields `T | undefined`, so prefer `for…of` over indexed `for` loops rather than sprinkling non-null assertions.
- `verbatimModuleSyntax` is on: type-only imports must be written `import type { … }`.
- `include` covers `src/**/*` only. `test/` is type-checked by Vitest and the editor, not by this config.
- Declarations are emitted by tsdown (`dts: true`), not by `tsc`. There is no `typecheck` script; run `npx tsc --noEmit`.

## Security

- **Never interpolate a value into a command string.** `ICommandRunner.run()` takes an explicit argv and never uses a shell, so arguments reach the process verbatim.
- Secrets go over stdin, not argv. `docker login --password-stdin` receives the registry password through `CommandOptions.stdin`, so it never appears in a process listing.
- In `action.yml`, inputs travel to the script through the `env:` block rather than `${{ }}` interpolation inside `run:`, so newlines and shell metacharacters in an input stay inert.

## Build Output

`npm run build` (tsdown) writes:

| File                | Contents                                  |
|---------------------|-------------------------------------------|
| `dist/index.mjs`    | Library ESM bundle                        |
| `dist/index.d.mts`  | Library type declarations                 |
| `dist/cli.mjs`      | CLI ESM bundle (executable bit set)       |
| `dist/*.map`        | Sourcemaps                                |

Shared code between the two entries is emitted as a chunk. `dist/` is git-ignored and is the only directory published to npm.

## Commit Convention

Commits follow **[Conventional Commits](https://www.conventionalcommits.org)**, which release-please parses to compute the next version and generate the changelog.

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

- `fix:` → patch bump. `feat:` → minor bump. `!` or a `BREAKING CHANGE:` footer → major.
- `build:`, `chore:`, `ci:`, `docs:`, `style:`, `refactor:`, `test:` → no release.
- Dependabot uses `fix` for production deps and `build` for dev deps, with the scope included. Match that when bumping dependencies by hand (e.g. `build(deps-dev): bump vitest to v4`).

## Release Process

Automated by `.github/workflows/release.yml` on every push to `master`:

1. **release-please** opens or updates a release PR that bumps the version, updates `CHANGELOG.md`, and syncs `.release-please-manifest.json`.
2. Merging it creates the git tag and GitHub release, and the workflow force-moves the floating `vN` and `vN.M` tags so `uses: tada5hi/craneship@v3` keeps working.
3. On that same run, install → build → **publish to npm** via `tada5hi/monoship@v2`.

Releases are never cut by hand.

## The Action

`action.yml` is a **composite** action, not a Docker action. It sets up Node, installs and builds inside `${{ github.action_path }}`, then runs `dist/cli.mjs`.

- Adding an input means touching three places: `action.yml` inputs, the `env:` block of the `Publish` step, and the `args` array in its script, plus `src/cli/args.ts` and `src/cli/options.ts`.
- The `Set up QEMU` step (`docker/setup-qemu-action@v4`) runs only when `platforms` is set, before `Publish`. It is a marketplace step like `actions/setup-node`, rather than a `docker run --privileged tonistiigi/binfmt` script, because it is Docker's maintained wrapper of that same image, caches it, and takes the platform list as is.
- Boolean inputs map to citty's negation flags (`--no-cleanup`, `--no-gitTag`) rather than `--cleanup false`.
- The `token` input is deprecated and unused. It stays declared so existing workflows do not emit an unexpected-input warning.

## Best Practices

- Use **ESM** and modern TypeScript; target ES2022 features freely.
- Before adding new code, study the surrounding patterns, naming and structure, and stay consistent with them.
- Keep `src/module.ts` free of concrete adapters. That constraint is what keeps the suite fast and daemon-free.
- Prefer upgrading a shared `@tada5hi/*` config over adding a local rule override.
