# Testing

## Setup

- **Runner**: [Vitest](https://vitest.dev)
- **Test location**: `test/unit/**/*.{test,spec}.{js,ts}`. Files outside this glob are **not** picked up
- **Config**: `test/vitest.config.ts` (not in the project root; the npm scripts pass `--config` explicitly)
- **Prerequisite**: `npm ci`. No docker daemon, database, container, or network is required.

## Running Tests

```bash
npm run test                                          # run all tests once
npm run test:coverage                                 # run all tests with coverage
npx vitest --config test/vitest.config.ts             # watch mode
npx vitest --config test/vitest.config.ts --run test/unit/module.spec.ts   # single file
```

`npm run test` already passes `--run`, so it never enters watch mode, which is safe for CI and for agents.

## Prefer fakes over mocks

This is the most important convention in the suite. Every side effect sits behind an `I`-prefixed interface with an in-memory implementation, so **use the memory adapter instead of `vi.fn()` / `vi.mock()`**.

Module mocking couples tests to import structure and hides breaking changes; a fake that satisfies the same interface fails to compile when the interface changes, which is exactly what you want.

```typescript
import { MemoryDockerClient, MemoryGitClient, NoopLogger } from '../../src/core/index.ts';
import { publish } from '../../src/module.ts';

const docker = new MemoryDockerClient();
const git = new MemoryGitClient();

const result = await publish(buildOptions(), {
    docker,
    git,
    logger: new NoopLogger(),
});

expect(result.images).toEqual(['ghcr.io/tada5hi/some-repo:latest']);
expect(docker.pushed).toEqual(['ghcr.io/tada5hi/some-repo:latest']);
```

`vi.spyOn` is acceptable at a genuine boundary the fakes do not cover: `test/unit/core/logger.spec.ts` spies on `consola` to prove `ConsolaLogger` delegates. `vi.mock` is not used anywhere and should stay that way.

### What each fake records

| Fake                  | Exposes                                                        |
|-----------------------|-----------------------------------------------------------------|
| `MemoryCommandRunner` | `calls`, `commandLines`, and `respondTo(prefix, response)`      |
| `MemoryDockerClient`  | `images`, `builds`, `pushed`, `removed`, `logins`, `logouts`, `builders`, `createdBuilders`, `removedBuilders`, `multiPlatformBuilds` |
| `MemoryGitClient`     | `clones`                                                         |

`MemoryDockerClient` also *enforces* invariants. Tagging or pushing an image it does not hold throws, so a test that gets the order wrong fails rather than silently passing. The same goes for building with, or removing, a builder it does not hold, and a multi-platform build never adds to `images` (it is pushed straight from the build, as with buildx). Pre-existing builders are its second constructor argument: `new MemoryDockerClient([], ['craneship'])`.

## Test Layers

### Orchestrator: `test/unit/module.spec.ts`

Drives `publish()` end to end against memory adapters. A local `buildOptions(extend)` helper builds a valid `Options` so each case only states what it varies:

```typescript
const result = await publish(buildOptions({ ref: 'refs/tags/v1.2.3', registryTags: [] }), context);

expect(result.images).toEqual(['ghcr.io/tada5hi/some-repo:1.2.3']);
```

### Adapters: `test/unit/core/**`

`DockerCLIClient` and `GitCLIClient` are tested against `MemoryCommandRunner`, asserting the exact argv:

```typescript
expect(runner.calls[0]?.args).toEqual([
    'login', 'ghcr.io', '--username', 'tada5hi', '--password-stdin',
]);
expect(runner.calls[0]?.options.stdin).toBe('p@ss word');
// the secret must never reach the argument vector
expect(runner.calls[0]?.args).not.toContain('p@ss word');
```

`NodeCommandRunner` is the one adapter tested for real: `test/unit/core/command/node.spec.ts` spawns `process.execPath` with `-e` scripts to verify stdout/stderr capture, stdin, streaming, exit codes, and spawn failure. It needs no external binary; the node running the tests is the subject.

### Pure helpers: `test/unit/utils/**`, `test/unit/cli/options.spec.ts`

Plain input/output assertions, no fakes needed.

## Conventions

- The top-level `describe` names the source file under test, as in `describe('src/module.ts', …)`.
- `it` titles read as `should …`.
- Tests mirror the `src/` path they cover: `src/core/docker/cli.ts` → `test/unit/core/docker/cli.spec.ts`.
- Relative imports carry the `.ts` extension, same as `src/`.

## Testing Philosophy

Tests assert *expected* behavior based on the module contract, not merely what the implementation currently does. If a test fails, it may have surfaced a real bug rather than a test error.

This has already paid off once: a spec asserting `some-package@v1.2.3` → `1.2.3` failed, and the cause was a genuine ordering bug in `trimRefName` (see [architecture](architecture.md#trimrefname)). The fix was to the implementation, not the test. Resist the reflex to change the assertion to match the output.

## Code Coverage

```bash
npm run test:coverage
```

Provider is **v8**, measured over `src/**/*.{ts,tsx,js,jsx}` with **nothing excluded**, so the report stays honest. Thresholds are enforced, so the command **fails** below any of them:

| Metric     | Threshold |
|------------|-----------|
| Branches   | 80%       |
| Functions  | 80%       |
| Lines      | 80%       |
| Statements | 80%       |

The only files with no coverage are the composition roots `src/cli.ts` and `src/cli/module.ts`, which just construct adapters and hand them to `publish()`. If you add logic there, move it into `src/cli/options.ts` (pure, fully tested) rather than lowering the threshold.

Reports land in `coverage/` (git-ignored).

## CI Pipeline

GitHub Actions (`.github/workflows/main.yml`) on pushes and PRs to `develop`, `master`, `next`, `beta`, `alpha`:

```
install ──► build ──┬──► lint   (npm run lint)
                    └──► tests  (npm run test:coverage)
```

Node 24, `npm ci`, with `node_modules` cached by `package-lock.json` hash and `dist/` cached by commit SHA. CI runs `test:coverage`, so the 80% thresholds gate merges.

## Writing New Tests

1. Place the file under `test/unit/`, mirroring the `src/` path, with a `.spec.ts` extension.
2. Reach for the memory adapter for anything with a side effect; add one to `src/core/<port>/memory.ts` if it does not exist yet.
3. Name the outer `describe` after the source file and phrase `it` titles as `should …`.
4. Run `npm run test`, and `npm run test:coverage` before pushing.
