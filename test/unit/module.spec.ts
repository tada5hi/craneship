import { 
    beforeEach, 
    describe, 
    expect, 
    it, 
} from 'vitest';
import {
    MemoryDockerClient,
    MemoryGitClient,
    NoopLogger,
} from '../../src/core/index.ts';
import { publish } from '../../src/module.ts';
import type { Options, PublishContext } from '../../src/types.ts';

function buildOptions(extend: Partial<Options> = {}) : Options {
    return {
        dockerFileName: 'Dockerfile',
        dockerFilePath: '',
        buildArgs: [],
        cleanup: true,
        clone: false,

        gitTag: true,
        gitTagPrefix: '',
        gitUser: 'tada5hi',
        gitPassword: 'some-password',

        registryHost: 'ghcr.io',
        registryUser: 'tada5hi',
        registryPassword: 'some-registry-password',
        registryRepository: 'tada5hi/some-repo',
        registryTags: ['latest'],

        ref: 'refs/heads/master',
        repository: 'tada5hi/some-repo',
        serverUrl: 'https://github.com',

        root: '/workspace',

        ...extend,
    };
}

describe('src/module.ts', () => {
    let docker : MemoryDockerClient;
    let git : MemoryGitClient;
    let context : PublishContext;

    beforeEach(() => {
        docker = new MemoryDockerClient();
        git = new MemoryGitClient();
        context = {
            docker, 
            git, 
            logger: new NoopLogger(), 
        };
    });

    it('should build and push the registry tags for a branch', async () => {
        const result = await publish(buildOptions(), context);

        expect(result.built).toBe(true);
        expect(result.images).toEqual(['ghcr.io/tada5hi/some-repo:latest']);
        expect(docker.pushed).toEqual(['ghcr.io/tada5hi/some-repo:latest']);
    });

    it('should not clone by default', async () => {
        await publish(buildOptions(), context);

        expect(git.clones).toHaveLength(0);
    });

    it('should build the working directory when not cloning', async () => {
        await publish(buildOptions({ dockerFilePath: 'services/api' }), context);

        expect(docker.builds[0]?.cwd).toBe('/workspace/services/api');
    });

    it('should clone the branch of a branch ref', async () => {
        await publish(buildOptions({ clone: true, ref: 'refs/heads/feature/some-thing' }), context);

        expect(git.clones[0]?.branch).toBe('feature/some-thing');
        expect(git.clones[0]?.url).toBe('https://github.com/tada5hi/some-repo');
    });

    it('should pin the clone to the tag of a tag ref', async () => {
        await publish(buildOptions({ clone: true, ref: 'refs/tags/v1.2.3' }), context);

        // --branch accepts a tag, which is what keeps the build off the
        // default branch tip when the tag is older than HEAD
        expect(git.clones[0]?.branch).toBe('v1.2.3');
    });

    it('should not restrict the clone for a pull ref', async () => {
        await publish(buildOptions({ clone: true, ref: 'refs/pulls/42' }), context);

        expect(git.clones[0]?.branch).toBeUndefined();
    });

    it('should derive the image tag from a git tag', async () => {
        const result = await publish(buildOptions({
            ref: 'refs/tags/v1.2.3',
            registryTags: [],
        }), context);

        expect(result.images).toEqual(['ghcr.io/tada5hi/some-repo:1.2.3']);
    });

    it('should push the git tag and the registry tags together', async () => {
        const result = await publish(buildOptions({
            ref: 'refs/tags/v1.2.3',
            registryTags: ['latest'],
        }), context);

        expect(result.images).toEqual([
            'ghcr.io/tada5hi/some-repo:1.2.3',
            'ghcr.io/tada5hi/some-repo:latest',
        ]);
    });

    it('should skip a git tag which does not match the prefix', async () => {
        const result = await publish(buildOptions({
            ref: 'refs/tags/other-package@1.2.3',
            gitTagPrefix: 'some-package',
            registryTags: [],
        }), context);

        expect(result.images).toEqual([]);
    });

    it('should strip the prefix of a matching git tag', async () => {
        const result = await publish(buildOptions({
            ref: 'refs/tags/some-package@1.2.3',
            gitTagPrefix: 'some-package',
            registryTags: [],
        }), context);

        expect(result.images).toEqual(['ghcr.io/tada5hi/some-repo:1.2.3']);
    });

    it('should lowercase the registry reference', async () => {
        const result = await publish(buildOptions({
            registryHost: 'GHCR.IO',
            registryRepository: 'TaDa5hi/Some-Repo',
        }), context);

        expect(result.images).toEqual(['ghcr.io/tada5hi/some-repo:latest']);
    });

    it('should collapse double slashes in the registry reference', async () => {
        const result = await publish(buildOptions({
            registryHost: 'ghcr.io/',
            registryRepository: '/tada5hi/some-repo',
        }), context);

        expect(result.images).toEqual(['ghcr.io/tada5hi/some-repo:latest']);
    });

    it('should skip the build when the image already exists', async () => {
        const options = buildOptions();

        // the local image id is derived from the ref, so a second run
        // against a daemon which already holds it must not rebuild
        const first = await publish(options, context);

        const existing = new MemoryDockerClient([first.imageId]);
        const second = await publish(options, { ...context, docker: existing });

        expect(first.built).toBe(true);
        expect(second.built).toBe(false);
        expect(existing.builds).toHaveLength(0);
    });

    it('should remove the built image when cleanup is enabled', async () => {
        const result = await publish(buildOptions({ cleanup: true }), context);

        expect(docker.removed).toContain(result.imageId);
    });

    it('should keep the built image when cleanup is disabled', async () => {
        const result = await publish(buildOptions({ cleanup: false }), context);

        expect(docker.removed).not.toContain(result.imageId);
    });

    it('should log in and out of the registry', async () => {
        await publish(buildOptions(), context);

        expect(docker.logins).toEqual([{
            host: 'ghcr.io',
            user: 'tada5hi',
            password: 'some-registry-password',
        }]);
        expect(docker.logouts).toEqual(['ghcr.io']);
    });

    it('should log out even when a push fails', async () => {
        const failing = new MemoryDockerClient();
        failing.pushImage = async () => {
            throw new Error('denied');
        };

        await expect(publish(buildOptions(), { ...context, docker: failing }))
            .rejects.toThrow('denied');

        expect(failing.logouts).toEqual(['ghcr.io']);
    });

    it('should reject an unparsable ref', async () => {
        await expect(publish(buildOptions({ ref: 'master' }), context))
            .rejects.toThrow(/could not be parsed/);
    });

    it('should label the image with the run identifiers', async () => {
        await publish(buildOptions({ runId: '42', runNumber: '7' }), context);

        expect(docker.builds[0]?.labels).toEqual({ runId: '42', runNumber: '7' });
    });

    it('should forward the docker file path to the clone directory', async () => {
        await publish(buildOptions({ clone: true, dockerFilePath: 'services/api' }), context);

        expect(docker.builds[0]?.cwd).toBe('/workspace/.output/services/api');
    });

    describe('multi-platform', () => {
        const platforms = ['linux/amd64', 'linux/arm64'];

        it('should keep the plain docker flow when no platforms are given', async () => {
            const result = await publish(buildOptions({ platforms: [] }), context);

            expect(docker.builds).toHaveLength(1);
            expect(docker.multiPlatformBuilds).toHaveLength(0);
            expect(docker.createdBuilders).toHaveLength(0);
            expect(docker.removed).toEqual([
                'ghcr.io/tada5hi/some-repo:latest',
                result.imageId,
            ]);
        });

        it('should build once for every platform and push every tag from that build', async () => {
            const result = await publish(buildOptions({
                dockerFilePath: 'images/sandbox-node',
                registryRepository: 'chamberu/sandbox-node',
                registryTags: ['24', '24-abc1234'],
                platforms,
            }), context);

            expect(result.built).toBe(true);
            expect(result.images).toEqual([
                'ghcr.io/chamberu/sandbox-node:24',
                'ghcr.io/chamberu/sandbox-node:24-abc1234',
            ]);

            // a multi-platform image cannot be loaded into the local daemon,
            // so nothing is built, tagged or pushed the plain way
            expect(docker.builds).toHaveLength(0);
            expect(docker.multiPlatformBuilds).toHaveLength(1);
            expect(docker.multiPlatformBuilds[0]).toMatchObject({
                images: result.images,
                platforms,
                builder: 'craneship',
                fileName: 'Dockerfile',
                cwd: '/workspace/images/sandbox-node',
            });
            expect(docker.pushed).toEqual(result.images);
        });

        it('should push the git tag and the registry tags together', async () => {
            const result = await publish(buildOptions({
                ref: 'refs/tags/v1.2.3',
                registryTags: ['latest'],
                platforms,
            }), context);

            expect(result.images).toEqual([
                'ghcr.io/tada5hi/some-repo:1.2.3',
                'ghcr.io/tada5hi/some-repo:latest',
            ]);
            expect(docker.multiPlatformBuilds[0]?.images).toEqual(result.images);
        });

        it('should forward labels and build args', async () => {
            await publish(buildOptions({
                runId: '42',
                runNumber: '7',
                buildArgs: ['FOO=bar'],
                platforms,
            }), context);

            expect(docker.multiPlatformBuilds[0]?.labels).toEqual({ runId: '42', runNumber: '7' });
            expect(docker.multiPlatformBuilds[0]?.buildArgs).toEqual(['FOO=bar']);
        });

        it('should build even when a local image for the ref exists', async () => {
            const options = buildOptions({ platforms });
            const first = await publish(buildOptions(), { ...context, docker: new MemoryDockerClient() });

            const existing = new MemoryDockerClient([first.imageId]);
            const result = await publish(options, { ...context, docker: existing });

            expect(result.built).toBe(true);
            expect(existing.multiPlatformBuilds).toHaveLength(1);
        });

        it('should skip the build when no tag is derived', async () => {
            const result = await publish(buildOptions({
                ref: 'refs/tags/other-package@1.2.3',
                gitTagPrefix: 'some-package',
                registryTags: [],
                platforms,
            }), context);

            expect(result.built).toBe(false);
            expect(result.images).toEqual([]);
            expect(docker.multiPlatformBuilds).toHaveLength(0);
            expect(docker.createdBuilders).toHaveLength(0);
        });

        it('should remove the builder it created when cleanup is enabled', async () => {
            await publish(buildOptions({ cleanup: true, platforms }), context);

            expect(docker.createdBuilders).toEqual(['craneship']);
            expect(docker.removedBuilders).toEqual(['craneship']);
            // there is no local image to remove
            expect(docker.removed).toEqual([]);
        });

        it('should keep the builder it created when cleanup is disabled', async () => {
            await publish(buildOptions({ cleanup: false, platforms }), context);

            expect(docker.createdBuilders).toEqual(['craneship']);
            expect(docker.removedBuilders).toEqual([]);
            expect(docker.builders.has('craneship')).toBe(true);
        });

        it('should never remove a builder it did not create', async () => {
            const existing = new MemoryDockerClient([], ['craneship']);

            await publish(buildOptions({ cleanup: true, platforms }), { ...context, docker: existing });

            expect(existing.createdBuilders).toEqual([]);
            expect(existing.removedBuilders).toEqual([]);
            expect(existing.multiPlatformBuilds[0]?.builder).toBe('craneship');
        });

        it('should remove the created builder and log out when the build fails', async () => {
            docker.buildAndPushImage = async () => {
                throw new Error('denied');
            };

            await expect(publish(buildOptions({ cleanup: true, platforms }), context))
                .rejects.toThrow('denied');

            expect(docker.removedBuilders).toEqual(['craneship']);
            expect(docker.logouts).toEqual(['ghcr.io']);
        });

        it('should log in before building', async () => {
            await publish(buildOptions({ platforms }), context);

            expect(docker.logins).toHaveLength(1);
            expect(docker.logouts).toEqual(['ghcr.io']);
        });
    });
});
