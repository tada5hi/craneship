import { describe, expect, it } from 'vitest';
import {
    CommandError,
    DockerCLIClient,
    MemoryCommandRunner,
} from '../../../../src/core/index.ts';
import type { CommandOptions, CommandResult } from '../../../../src/core/index.ts';

describe('src/core/docker/cli.ts', () => {
    it('should pass the registry password through stdin', async () => {
        const runner = new MemoryCommandRunner();
        const client = new DockerCLIClient(runner);

        await client.login({
            host: 'ghcr.io', 
            user: 'tada5hi', 
            password: 'p@ss word', 
        });

        const call = runner.calls[0];

        expect(call?.args).toEqual([
            'login',
            'ghcr.io',
            '--username',
            'tada5hi',
            '--password-stdin',
        ]);
        expect(call?.options.stdin).toBe('p@ss word');
        // the secret must never reach the argument vector
        expect(call?.args).not.toContain('p@ss word');
    });

    it('should report an existing image', async () => {
        const runner = new MemoryCommandRunner()
            .respondTo('docker images -q', { stdout: 'a1b2c3\n' });

        expect(await new DockerCLIClient(runner).imageExists('a1b2c3')).toBe(true);
    });

    it('should report a missing image', async () => {
        const runner = new MemoryCommandRunner()
            .respondTo('docker images -q', { stdout: '\n' });

        expect(await new DockerCLIClient(runner).imageExists('a1b2c3')).toBe(false);
    });

    it('should build with labels and build args', async () => {
        const runner = new MemoryCommandRunner();

        await new DockerCLIClient(runner).buildImage({
            image: 'some-id',
            fileName: 'Dockerfile',
            cwd: '/workspace/.output',
            labels: { runId: '1', runNumber: '2' },
            buildArgs: ['FOO=bar'],
        });

        expect(runner.calls[0]?.args).toEqual([
            'build',
            '.',
            '--file',
            'Dockerfile',
            '--tag',
            'some-id',
            '--label',
            'runId=1',
            '--label',
            'runNumber=2',
            '--build-arg',
            'FOO=bar',
        ]);
        expect(runner.calls[0]?.options.cwd).toBe('/workspace/.output');
    });

    it('should accept build args as a record', async () => {
        const runner = new MemoryCommandRunner();

        await new DockerCLIClient(runner).buildImage({
            image: 'some-id',
            fileName: 'Dockerfile',
            cwd: '/workspace',
            buildArgs: { FOO: 'bar' },
        });

        expect(runner.calls[0]?.args).toContain('FOO=bar');
    });

    it('should tag, push and remove images', async () => {
        const runner = new MemoryCommandRunner();
        const client = new DockerCLIClient(runner);

        await client.tagImage('some-id', 'ghcr.io/tada5hi/some-repo:latest');
        await client.pushImage('ghcr.io/tada5hi/some-repo:latest');
        await client.removeImage('ghcr.io/tada5hi/some-repo:latest');
        await client.logout('ghcr.io');

        expect(runner.commandLines).toEqual([
            'docker tag some-id ghcr.io/tada5hi/some-repo:latest',
            'docker push ghcr.io/tada5hi/some-repo:latest',
            'docker image rm --force ghcr.io/tada5hi/some-repo:latest',
            'docker logout ghcr.io',
        ]);
    });

    it('should reuse the current builder when it is not the docker driver', async () => {
        const runner = new MemoryCommandRunner()
            .respondTo('docker buildx inspect', { stdout: 'Name:          ci\nDriver:        docker-container\n\nNodes:\nName:          ci0\n' });

        const builder = await new DockerCLIClient(runner).ensureMultiPlatformBuilder();

        expect(builder).toEqual({ name: 'ci', created: false });
        expect(runner.commandLines).toEqual(['docker buildx inspect']);
    });

    it('should reuse an existing craneship builder over the docker driver', async () => {
        const runner = new MemoryCommandRunner()
            .respondTo('docker buildx inspect craneship', { stdout: 'Name:          craneship\nDriver:        docker-container\n' })
            .respondTo('docker buildx inspect', { stdout: 'Name:          default\nDriver:        docker\n' });

        const builder = await new DockerCLIClient(runner).ensureMultiPlatformBuilder();

        expect(builder).toEqual({ name: 'craneship', created: false });
        expect(runner.commandLines).toEqual([
            'docker buildx inspect',
            'docker buildx inspect craneship',
        ]);
    });

    it('should create a docker-container builder when the docker driver is current', async () => {
        const runner = new MemoryCommandRunner()
            .respondTo('docker buildx inspect craneship', { code: 1, stderr: 'no builder "craneship" found' })
            .respondTo('docker buildx inspect', { stdout: 'Name:          default\nDriver:        docker\n' });

        const builder = await new DockerCLIClient(runner).ensureMultiPlatformBuilder();

        expect(builder).toEqual({ name: 'craneship', created: true });
        // the builder is selected per build with --builder, never made
        // the current one, so later steps of the job are not affected
        expect(runner.commandLines).toEqual([
            'docker buildx inspect',
            'docker buildx inspect craneship',
            'docker buildx create --name craneship --driver docker-container --bootstrap',
        ]);
    });

    it('should not mistake a failed spawn for a missing builder', async () => {
        class SpawnFailingRunner extends MemoryCommandRunner {
            override async run(command: string, args: string[], options?: CommandOptions) : Promise<CommandResult> {
                if (args.join(' ') === 'buildx inspect craneship') {
                    throw CommandError.spawnFailed(command, args, new Error('EAGAIN'));
                }

                return super.run(command, args, options);
            }
        }

        const runner = new SpawnFailingRunner()
            .respondTo('docker buildx inspect', { stdout: 'Name:          default\nDriver:        docker\n' });

        await expect(new DockerCLIClient(runner).ensureMultiPlatformBuilder())
            .rejects.toThrow(/could not be spawned/);
        expect(runner.commandLines).not.toContain(
            'docker buildx create --name craneship --driver docker-container --bootstrap',
        );
    });

    it('should reject when buildx is not available', async () => {
        const runner = new MemoryCommandRunner()
            .respondTo('docker buildx inspect', { code: 1, stderr: 'unknown command: docker buildx' });

        await expect(new DockerCLIClient(runner).ensureMultiPlatformBuilder())
            .rejects.toThrow(/exit code 1/);
    });

    it('should build for every platform and push every reference at once', async () => {
        const runner = new MemoryCommandRunner();

        await new DockerCLIClient(runner).buildAndPushImage({
            images: [
                'ghcr.io/tada5hi/some-repo:24',
                'ghcr.io/tada5hi/some-repo:24-abc1234',
            ],
            platforms: ['linux/amd64', 'linux/arm64'],
            builder: 'craneship',
            fileName: 'Dockerfile',
            cwd: '/workspace/images/sandbox-node',
            labels: { runId: '1' },
            buildArgs: ['FOO=bar'],
        });

        expect(runner.calls[0]?.args).toEqual([
            'buildx',
            'build',
            '.',
            '--builder',
            'craneship',
            '--file',
            'Dockerfile',
            '--platform',
            'linux/amd64,linux/arm64',
            '--tag',
            'ghcr.io/tada5hi/some-repo:24',
            '--tag',
            'ghcr.io/tada5hi/some-repo:24-abc1234',
            '--label',
            'runId=1',
            '--build-arg',
            'FOO=bar',
            '--push',
        ]);
        expect(runner.calls[0]?.options.cwd).toBe('/workspace/images/sandbox-node');
    });

    it('should build with the current builder when none is given', async () => {
        const runner = new MemoryCommandRunner();

        await new DockerCLIClient(runner).buildAndPushImage({
            images: ['ghcr.io/tada5hi/some-repo:latest'],
            platforms: ['linux/arm64'],
            fileName: 'Dockerfile',
            cwd: '/workspace',
            buildArgs: { FOO: 'bar' },
        });

        expect(runner.calls[0]?.args).not.toContain('--builder');
        expect(runner.calls[0]?.args).toContain('FOO=bar');
    });

    it('should remove a builder', async () => {
        const runner = new MemoryCommandRunner();

        await new DockerCLIClient(runner).removeBuilder('craneship');

        expect(runner.commandLines).toEqual(['docker buildx rm craneship']);
    });

    it('should reject when the docker command fails', async () => {
        const runner = new MemoryCommandRunner()
            .respondTo('docker push', { code: 1, stderr: 'denied' });

        await expect(new DockerCLIClient(runner).pushImage('some-image'))
            .rejects.toThrow(/exit code 1/);
    });
});
