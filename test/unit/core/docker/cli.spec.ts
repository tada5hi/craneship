import { describe, expect, it } from 'vitest';
import {
    CommandError,
    DockerCLIClient,
    MemoryCommandRunner,
} from '../../../../src/core/index.ts';
import type { CommandOptions, CommandResult } from '../../../../src/core/index.ts';

/**
 * Throws the error the intercept returns for an invocation, before any
 * scripted response is consulted. Lets a test fail one call of a command
 * which succeeds otherwise, or fail it with a spawn error.
 */
class InterceptingRunner extends MemoryCommandRunner {
    protected intercept : (line: string) => Error | undefined;

    constructor(intercept: (line: string) => Error | undefined) {
        super();

        this.intercept = intercept;
    }

    override async run(command: string, args: string[], options?: CommandOptions) : Promise<CommandResult> {
        const error = this.intercept(args.join(' '));
        if (error) {
            this.calls.push({
                command,
                args,
                options: options ?? {},
            });

            throw error;
        }

        return super.run(command, args, options);
    }
}

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

        const builder = await new DockerCLIClient(runner).ensureMultiPlatformBuilder({ shared: true });

        expect(builder).toEqual({ name: 'ci', created: false });
        expect(runner.commandLines).toEqual(['docker buildx inspect']);
    });

    it('should reuse an existing craneship builder over the docker driver', async () => {
        const runner = new MemoryCommandRunner()
            .respondTo('docker buildx inspect craneship', { stdout: 'Name:          craneship\nDriver:        docker-container\n' })
            .respondTo('docker buildx inspect', { stdout: 'Name:          default\nDriver:        docker\n' });

        const builder = await new DockerCLIClient(runner).ensureMultiPlatformBuilder({ shared: true });

        expect(builder).toEqual({ name: 'craneship', created: false });
        expect(runner.commandLines).toEqual([
            'docker buildx inspect',
            'docker buildx inspect craneship',
        ]);
    });

    it('should reuse the current builder for a private build when it is not the docker driver', async () => {
        const runner = new MemoryCommandRunner()
            .respondTo('docker buildx inspect', { stdout: 'Name:          ci\nDriver:        docker-container\n' });

        const builder = await new DockerCLIClient(runner).ensureMultiPlatformBuilder({ shared: false });

        expect(builder).toEqual({ name: 'ci', created: false });
        expect(runner.commandLines).toEqual(['docker buildx inspect']);
    });

    it('should create a uniquely named builder for a private build', async () => {
        const runner = new MemoryCommandRunner()
            .respondTo('docker buildx inspect', { stdout: 'Name:          default\nDriver:        docker\n' });

        const client = new DockerCLIClient(runner);
        const first = await client.ensureMultiPlatformBuilder({ shared: false });
        const second = await client.ensureMultiPlatformBuilder({ shared: false });

        expect(first.created).toBe(true);
        expect(first.name).toMatch(/^craneship-[0-9a-f]{8}$/);
        expect(second.name).not.toBe(first.name);
        // never looked up, so a builder of a concurrent run is never taken over
        expect(runner.commandLines).not.toContain('docker buildx inspect craneship');
        expect(runner.commandLines[1]).toBe(
            `docker buildx create --name ${first.name} --driver docker-container --bootstrap`,
        );
    });

    it('should reuse the shared builder when a concurrent run created it first', async () => {
        let lookups = 0;

        // missing on the first lookup, there after the failed create
        const runner = new InterceptingRunner((line) => {
            if (line !== 'buildx inspect craneship' || lookups++ > 0) {
                return undefined;
            }

            return CommandError.exitedNonZero('docker', line.split(' '), {
                stdout: '',
                stderr: 'no builder "craneship" found',
                code: 1,
            });
        })
            .respondTo('docker buildx create', { code: 1, stderr: 'existing instance for "craneship"' })
            .respondTo('docker buildx inspect', { stdout: 'Name:          default\nDriver:        docker\n' });

        const builder = await new DockerCLIClient(runner).ensureMultiPlatformBuilder({ shared: true });

        expect(builder).toEqual({ name: 'craneship', created: false });
        expect(runner.commandLines).toEqual([
            'docker buildx inspect',
            'docker buildx inspect craneship',
            'docker buildx create --name craneship --driver docker-container --bootstrap',
            'docker buildx inspect craneship',
        ]);
    });

    it('should remove a private builder whose creation failed', async () => {
        const runner = new MemoryCommandRunner()
            .respondTo('docker buildx create', { code: 1, stderr: 'failed to bootstrap' })
            .respondTo('docker buildx inspect', { stdout: 'Name:          default\nDriver:        docker\n' });

        await expect(new DockerCLIClient(runner).ensureMultiPlatformBuilder({ shared: false }))
            .rejects.toThrow(/exit code 1/);

        const name = runner.calls[1]?.args[3];
        expect(name).toMatch(/^craneship-[0-9a-f]{8}$/);
        expect(runner.commandLines[2]).toBe(`docker buildx rm ${name}`);
    });

    it('should report the create error when the follow-up lookup cannot be spawned', async () => {
        let lookups = 0;

        // missing on the first lookup, unspawnable on the second
        const runner = new InterceptingRunner((line) => {
            if (line !== 'buildx inspect craneship') {
                return undefined;
            }

            if (lookups++ === 0) {
                return CommandError.exitedNonZero('docker', line.split(' '), {
                    stdout: '',
                    stderr: 'no builder "craneship" found',
                    code: 1,
                });
            }

            return CommandError.spawnFailed('docker', line.split(' '), new Error('EAGAIN'));
        })
            .respondTo('docker buildx create', { code: 1, stderr: 'permission denied' })
            .respondTo('docker buildx inspect', { stdout: 'Name:          default\nDriver:        docker\n' });

        await expect(new DockerCLIClient(runner).ensureMultiPlatformBuilder({ shared: true }))
            .rejects.toThrow(/exit code 1/);
    });

    it('should reject when the shared builder can neither be created nor found', async () => {
        const runner = new MemoryCommandRunner()
            .respondTo('docker buildx inspect craneship', { code: 1, stderr: 'no builder "craneship" found' })
            .respondTo('docker buildx create', { code: 1, stderr: 'permission denied' })
            .respondTo('docker buildx inspect', { stdout: 'Name:          default\nDriver:        docker\n' });

        await expect(new DockerCLIClient(runner).ensureMultiPlatformBuilder({ shared: true }))
            .rejects.toThrow(/exit code 1/);
    });

    it('should create a docker-container builder when the docker driver is current', async () => {
        const runner = new MemoryCommandRunner()
            .respondTo('docker buildx inspect craneship', { code: 1, stderr: 'no builder "craneship" found' })
            .respondTo('docker buildx inspect', { stdout: 'Name:          default\nDriver:        docker\n' });

        const builder = await new DockerCLIClient(runner).ensureMultiPlatformBuilder({ shared: true });

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
        const runner = new InterceptingRunner((line) => (line === 'buildx inspect craneship' ?
            CommandError.spawnFailed('docker', line.split(' '), new Error('EAGAIN')) :
            undefined))
            .respondTo('docker buildx inspect', { stdout: 'Name:          default\nDriver:        docker\n' });

        await expect(new DockerCLIClient(runner).ensureMultiPlatformBuilder({ shared: true }))
            .rejects.toThrow(/could not be spawned/);
        expect(runner.commandLines).not.toContain(
            'docker buildx create --name craneship --driver docker-container --bootstrap',
        );
    });

    it('should reject when buildx is not available', async () => {
        const runner = new MemoryCommandRunner()
            .respondTo('docker buildx inspect', { code: 1, stderr: 'unknown command: docker buildx' });

        await expect(new DockerCLIClient(runner).ensureMultiPlatformBuilder({ shared: false }))
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
