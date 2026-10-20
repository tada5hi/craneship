# Project Structure

Single npm package, no workspaces and no monorepo tooling. One source tree produces a library, a CLI, and a composite GitHub Action.

## Directory Layout

```
craneship/
├── src/
│   ├── index.ts                     # Library barrel, the public API surface
│   ├── cli.ts                       # CLI entry (#!/usr/bin/env node, citty runMain)
│   ├── module.ts                    # publish(), the orchestrator; takes its ports as arguments
│   ├── types.ts                     # Options, GithubRef, PublishContext, PublishResult
│   ├── constants.ts                 # Defaults shared by the CLI args and the option builder
│   ├── cli/
│   │   ├── args.ts                  # citty arg definitions; defaults read GITHUB_* env vars
│   │   ├── options.ts               # args -> Options (pure, fully tested)
│   │   ├── module.ts                # createCLIEntryPointCommand(), composition root
│   │   └── index.ts
│   ├── core/                        # One directory per port
│   │   ├── command/                 # ICommandRunner: spawn a process with an explicit argv
│   │   │   ├── types.ts             #   the interface + CommandOptions/CommandResult
│   │   │   ├── node.ts              #   NodeCommandRunner (real, uses node:child_process spawn)
│   │   │   ├── memory.ts            #   MemoryCommandRunner (records calls, scripts responses)
│   │   │   ├── error.ts             #   CommandError with the captured result
│   │   │   └── index.ts
│   │   ├── docker/                  # IDockerClient: login/logout/exists/build/tag/push/remove, buildx builder + multi-platform build
│   │   │   ├── types.ts
│   │   │   ├── constants.ts         #   DOCKER_BUILDER_NAME (the shared buildx builder; private ones get a suffix)
│   │   │   ├── cli.ts               #   DockerCLIClient, shells out via ICommandRunner
│   │   │   ├── memory.ts            #   MemoryDockerClient, tracks an in-memory image set
│   │   │   ├── url.ts               #   buildDockerImageURL (pure)
│   │   │   └── index.ts
│   │   ├── git/                     # IGitClient: clone
│   │   │   ├── types.ts
│   │   │   ├── cli.ts               #   GitCLIClient + escapeCredential/buildCloneURL
│   │   │   ├── memory.ts
│   │   │   └── index.ts
│   │   ├── logger/                  # ILogger: debug/info/warn/error
│   │   │   ├── types.ts
│   │   │   ├── consola.ts           #   ConsolaLogger
│   │   │   ├── noop.ts              #   NoopLogger (used by tests)
│   │   │   └── index.ts
│   │   └── index.ts                 # Re-exports every port directory
│   └── utils/                       # Pure helpers, no side effects
│       ├── boolean.ts               #   toBoolean
│       ├── ref.ts                   #   parseGitHubRef
│       ├── ref-name.ts              #   trimRefName (semver-aware tag normalisation)
│       ├── url.ts                   #   cleanDoubleSlashes
│       └── index.ts
├── test/
│   ├── unit/                        # Mirrors the src/ path of the file under test
│   │   ├── module.spec.ts
│   │   ├── cli/options.spec.ts
│   │   ├── core/{command,docker,git}/…
│   │   └── utils/…
│   └── vitest.config.ts             # NOT in the project root; scripts pass --config
├── dist/                            # Build output (git-ignored, produced by tsdown)
├── .github/
│   ├── assets/logo.svg              # README header logo
│   ├── actions/{install,build}/     # Composite actions reused by both workflows
│   ├── workflows/
│   │   ├── main.yml                 # CI: install -> build -> (lint, test:coverage)
│   │   └── release.yml              # release-please -> build -> monoship publish
│   └── dependabot.yml
├── action.yml                       # The composite action; maps inputs -> CLI flags
├── tsconfig.json                    # extends @tada5hi/tsconfig; noEmit; types: ["node"]
├── tsdown.config.ts                 # Two entries: src/index.ts and src/cli.ts
├── eslint.config.js                 # Flat config wrapping @tada5hi/eslint-config
├── commitlint.config.mjs
├── release-please-config.json
└── .release-please-manifest.json
```

## Module Responsibilities

| Module                   | Purpose                                                                                                  |
|--------------------------|----------------------------------------------------------------------------------------------------------|
| `src/module.ts`          | The whole publish flow (single-platform and buildx multi-platform). Pure orchestration; it never spawns a process itself, only calls its ports. |
| `src/cli/module.ts`      | Composition root: constructs `NodeCommandRunner`, `DockerCLIClient`, `GitCLIClient`, `ConsolaLogger`.      |
| `src/cli/options.ts`     | Translates citty args into `Options`. Where defaults and multi-value splitting live (`toLines`, `toList`). |
| `src/core/*/types.ts`    | The `I`-prefixed interface for that port. Everything else in the directory implements it.                  |
| `src/utils/`             | Pure functions with no imports from `core/`. Safe to call from anywhere.                                   |

## Dependency Direction

```
cli.ts ──► cli/module.ts ──► core/*/{cli,node,consola}.ts   (adapters)
                │                        │
                └──► module.ts ──► core/*/types.ts          (interfaces)
                          │
                          └──► utils/                       (pure)
```

`src/module.ts` imports **only** interfaces and pure helpers, never a concrete adapter. That is what lets the tests run it against memory adapters. If you find yourself importing `DockerCLIClient` into `module.ts`, the design has been broken.

## Key Dependencies

| Runtime dependency | Role                                                              |
|--------------------|-------------------------------------------------------------------|
| `citty`            | CLI argument parsing and `--help`                                 |
| `consola`          | Console output behind `ConsolaLogger`                             |
| `md5`              | Derives the local image id from the git ref                       |
| `semver`           | Validates versions in `trimRefName` before stripping a `v` prefix  |

| Dev dependency                 | Role                                                  |
|--------------------------------|-------------------------------------------------------|
| `tsdown`                       | Bundler; emits `dist/*.mjs`, `dist/*.d.mts`, sourcemaps |
| `vitest` + `@vitest/coverage-v8` | Test runner and coverage                            |
| `typescript`                   | Type checking (`noEmit`)                              |
| `eslint` + `@tada5hi/eslint-config` | Linting                                          |
| `@tada5hi/tsconfig`            | Shared base `tsconfig`                                |
| `@tada5hi/commitlint-config`   | Conventional Commits rules                            |
| `husky`                        | Installs the git hooks path via `prepare`             |

There is intentionally **no** `@actions/core` or `@actions/github` dependency. The CLI reads the `GITHUB_*` environment variables directly, which keeps it usable outside GitHub Actions.

## Package Exports

```json
{
    "main": "dist/index.mjs",
    "types": "dist/index.d.mts",
    "bin": { "craneship": "dist/cli.mjs" },
    "exports": {
        "./package.json": "./package.json",
        ".": {
            "types": "./dist/index.d.mts",
            "import": "./dist/index.mjs"
        }
    },
    "files": ["dist"]
}
```

- **ESM-only.** `"type": "module"`, no `require` condition, no CJS output.
- Only `dist/` is published, so anything not reachable from `src/index.ts` or `src/cli.ts` never ships.
- Add new modules under `src/` and re-export them from the nearest `index.ts` barrel, up to `src/index.ts` if they are public.
