# Architecture

The package follows a **ports and adapters** (hexagonal) design. Every side effect (spawning a process, talking to docker, cloning a repository, writing to the console) sits behind an interface with at least two implementations: a real one and an in-memory one.

This is what makes `publish()` testable: the whole publish flow is exercised in unit tests without a docker daemon, a registry, or a network.

## Ports

A port is declared in `types.ts` as an `I`-prefixed interface, and every implementation in that directory satisfies it.

| Port             | Interface        | Real adapter        | Memory adapter        |
|------------------|------------------|---------------------|-----------------------|
| Process spawning | `ICommandRunner` | `NodeCommandRunner` | `MemoryCommandRunner` |
| Docker           | `IDockerClient`  | `DockerCLIClient`   | `MemoryDockerClient`  |
| Git              | `IGitClient`     | `GitCLIClient`      | `MemoryGitClient`     |
| Logging          | `ILogger`        | `ConsolaLogger`     | `NoopLogger`          |

```typescript
// src/core/docker/types.ts
export interface IDockerClient {
    login(credentials: RegistryCredentials) : Promise<void>;
    logout(host: string) : Promise<void>;
    imageExists(image: string) : Promise<boolean>;
    buildImage(options: ImageBuildOptions) : Promise<void>;
    tagImage(source: string, target: string) : Promise<void>;
    pushImage(image: string) : Promise<void>;
    removeImage(image: string) : Promise<void>;

    // multi-platform builds (docker buildx)
    ensureMultiPlatformBuilder() : Promise<MultiPlatformBuilder>;
    removeBuilder(name: string) : Promise<void>;
    buildAndPushImage(options: MultiPlatformBuildOptions) : Promise<void>;
}
```

### Adapters layer on each other

`DockerCLIClient` and `GitCLIClient` do not spawn processes themselves. They depend on `ICommandRunner`. That is one more seam: a docker test can assert the exact argv without stubbing `node:child_process`.

```typescript
// src/core/docker/cli.ts
export class DockerCLIClient implements IDockerClient {
    constructor(runner: ICommandRunner, binary = 'docker') { … }

    async login(credentials: RegistryCredentials) : Promise<void> {
        // the password is written to stdin, so it never appears
        // in the argument vector or in a shell command line.
        await this.runner.run(this.binary, [
            'login', credentials.host,
            '--username', credentials.user,
            '--password-stdin',
        ], { stdin: credentials.password });
    }
}
```

### No shell, ever

`ICommandRunner.run()` takes `(command, args[], options)` and uses `spawn` **without** `shell: true`. Arguments reach the process verbatim, so no caller has to quote or escape anything, and a registry password or a branch name containing shell metacharacters is inert.

When adding an adapter, never build a single command string. If you catch yourself writing `` `docker ${x}` ``, you have reintroduced the injection surface.

## Dependency Injection

`publish()` receives its ports as a plain object. There is no container and no framework.

```typescript
// src/types.ts
export type PublishContext = {
    docker: IDockerClient,
    git: IGitClient,
    logger: ILogger
};

// src/module.ts
export async function publish(
    options: Options,
    context: PublishContext,
) : Promise<PublishResult>
```

Wiring happens only at the composition root, `src/cli/module.ts`:

```typescript
const runner = new NodeCommandRunner({ stream: (chunk) => process.stdout.write(chunk) });

const result = await publish(options, {
    docker: new DockerCLIClient(runner),
    git: new GitCLIClient(runner),
    logger,
});
```

Tests build the same shape from memory adapters. Nothing else in `src/` constructs an adapter.

## The publish flow

```
Options ──► parseGitHubRef(options.ref)
                │  invalid -> throw
                ▼
            options.clone ?        opt-in; the workspace is the build context by default.
                git.clone()        --branch pins branches AND tags; pull refs clone the default
                │
                ▼
            imageId = md5(ref)     the same ref always maps to the same local id
            images = derive tags   see Tag derivation below
                │
                ├─ platforms set ──► multi-platform flow (below)
                ▼
            docker.imageExists(imageId)
                │
            docker.login()
                │
                ├─ not exists ──► docker.buildImage()   once, with runId/runNumber labels
                │
                ▼
            for each image:
                docker.tagImage(imageId, image)
                docker.pushImage(image)
                docker.removeImage(image)      the remote tag only, not the built image
                │
                ▼
            cleanup ? docker.removeImage(imageId) : keep
                │
                ▼ (finally)
            docker.logout()
```

`docker.logout()` sits in a `finally`, so a failed build or push still tears down the registry session.

### Multi-platform flow

With `options.platforms` non-empty (`platforms` input, `--platforms`, comma or newline separated via `toList`), `publish()` takes a separate branch, `publishMultiPlatform()`:

```
images empty ? return (built: false)   buildx refuses --push without a tag
    │
docker.login()
    │
docker.ensureMultiPlatformBuilder()    { name?, created }
    │
docker.buildAndPushImage({ images, platforms, builder, ... })
    │                                  one `docker buildx build --platform a,b --tag x --tag y --push`
    ▼ (finally)
cleanup && created ? docker.removeBuilder(name) : keep
    ▼ (finally)
docker.logout()
```

- A multi-platform image cannot be loaded into the local daemon, so the build-once-then-tag-and-push flow does not apply: there is no `imageExists` short-cut, no `tagImage`/`pushImage`, and no local image to remove. `result.imageId` is still `md5(ref)`, but nothing is tagged with it.
- `DockerCLIClient.ensureMultiPlatformBuilder()` reads `docker buildx inspect`. Any driver other than `docker` is reused as is (its `Name`). With the `docker` driver it reuses a builder named `DOCKER_BUILDER_NAME` (`craneship`) or creates one (`buildx create --driver docker-container --bootstrap`). It never runs `buildx use`; the build selects it with `--builder`, so later steps of the job keep their builder. Only a non-zero exit of `buildx inspect craneship` counts as "missing"; a spawn failure rethrows.
- `cleanup` removes only a builder this run created, so a builder left by an earlier step (`cleanup: false`) or by `docker/setup-buildx-action` survives.
- QEMU is not the CLI's job: `action.yml` runs `docker/setup-qemu-action@v4` with the requested platforms before the Publish step, only when `platforms` is set. Outside Actions the user registers binfmt handlers.

## Tag derivation

Two independent rules can each contribute tags, and both can fire for the same ref:

1. **From the git tag**: only when `gitTag` is enabled, the ref is a tag, and either `gitTagPrefix` is empty or the tag starts with it. The name is normalised by `trimRefName`.
2. **From `registryTags`**: when the ref is not a tag, or `gitTag` is disabled, or `registryTags` is non-empty.

So `refs/tags/v1.2.3` with `registryTag: latest` pushes **both** `:1.2.3` and `:latest`.

### `trimRefName`

```typescript
trimRefName('v1.2.3')                            // '1.2.3'
trimRefName('vNext')                             // 'vNext'  (not semver, v is kept)
trimRefName('some-package@v1.2.3', 'some-package') // '1.2.3'
trimRefName('some-package@1.2.3',  'some-package') // '1.2.3'
```

The `@v…` check must run **before** the `@…` check: `semver.valid('v1.2.3')` accepts a leading `v`, so testing the bare case first would match and return the version with its `v` still attached. That ordering bug shipped until it was caught by a spec. Do not "simplify" the two branches back together.

### `buildDockerImageURL`

Appends `:tag`, or `@tag` when the tag starts with `sha` (digest references). A reference which already carries a `:` or `@` is returned unchanged.

## Extending

To add a new side effect (a registry API, a filesystem read, a clock):

1. Create `src/core/<name>/types.ts` with an `I`-prefixed interface.
2. Add the real adapter, and a `memory.ts` fake satisfying the same interface.
3. Re-export both from `src/core/<name>/index.ts` and add the directory to `src/core/index.ts`.
4. Add the port to `PublishContext` and inject it in `src/cli/module.ts`.
5. Test `publish()` against the memory adapter, see [testing](testing.md).
