/*
 * Copyright (c) 2025-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { randomBytes } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { CommandError } from '../command/index.ts';
import type { ICommandRunner } from '../command/index.ts';
import { DOCKER_BUILDER_NAME } from './constants.ts';
import type {
    IDockerClient,
    ImageBuildOptions,
    MultiPlatformBuildOptions,
    MultiPlatformBuilder,
    MultiPlatformBuilderOptions,
    RegistryCredentials,
} from './types.ts';

function readInspectField(output: string, field: string) : string | undefined {
    // the first occurrence describes the builder, later ones its nodes
    const match = output.match(new RegExp(`^${field}:\\s*(\\S+)`, 'm'));

    return match?.[1];
}

/**
 * Docker client backed by the docker CLI.
 *
 * The CLI is preferred over the daemon API because it brings BuildKit,
 * .dockerignore handling and credential helpers for free.
 */
export class DockerCLIClient implements IDockerClient {
    protected runner : ICommandRunner;

    protected binary : string;

    constructor(runner: ICommandRunner, binary = 'docker') {
        this.runner = runner;
        this.binary = binary;
    }

    async login(credentials: RegistryCredentials) : Promise<void> {
        // the password is written to stdin, so it never appears
        // in the argument vector or in a shell command line.
        await this.runner.run(
            this.binary,
            [
                'login',
                credentials.host,
                '--username',
                credentials.user,
                '--password-stdin',
            ],
            { stdin: credentials.password },
        );
    }

    async logout(host: string) : Promise<void> {
        await this.runner.run(this.binary, ['logout', host]);
    }

    async imageExists(image: string) : Promise<boolean> {
        const result = await this.runner.run(this.binary, ['images', '-q', image]);

        return result.stdout.trim().length > 0;
    }

    async buildImage(options: ImageBuildOptions) : Promise<void> {
        const args : string[] = [
            'build',
            '.',
            '--file',
            options.fileName,
            '--tag',
            options.image,
            ...this.buildMetadataArgs(options),
        ];

        await this.runner.run(this.binary, args, { cwd: this.resolveContext(options.cwd) });
    }

    async ensureMultiPlatformBuilder(options: MultiPlatformBuilderOptions) : Promise<MultiPlatformBuilder> {
        const current = await this.runner.run(this.binary, ['buildx', 'inspect']);

        // The docker driver builds into the local image store, which cannot
        // hold an image for several platforms (unless the containerd image
        // store is enabled). Every other driver can, so it is reused as is.
        if (readInspectField(current.stdout, 'Driver') !== 'docker') {
            const name = readInspectField(current.stdout, 'Name');

            return name ? { name, created: false } : { created: false };
        }

        if (!options.shared) {
            const name = `${DOCKER_BUILDER_NAME}-${randomBytes(4).toString('hex')}`;
            await this.createBuilder(name);

            return { name, created: true };
        }

        if (await this.builderExists(DOCKER_BUILDER_NAME)) {
            return { name: DOCKER_BUILDER_NAME, created: false };
        }

        try {
            await this.createBuilder(DOCKER_BUILDER_NAME);
        } catch (error) {
            // a concurrent run may have created it in the meantime
            if (
                !(error instanceof CommandError) ||
                !error.result ||
                !await this.builderExists(DOCKER_BUILDER_NAME)
            ) {
                throw error;
            }

            return { name: DOCKER_BUILDER_NAME, created: false };
        }

        return { name: DOCKER_BUILDER_NAME, created: true };
    }

    async removeBuilder(name: string) : Promise<void> {
        await this.runner.run(this.binary, ['buildx', 'rm', name]);
    }

    async buildAndPushImage(options: MultiPlatformBuildOptions) : Promise<void> {
        const args : string[] = ['buildx', 'build', '.'];

        if (options.builder) {
            args.push('--builder', options.builder);
        }

        args.push(
            '--file',
            options.fileName,
            '--platform',
            options.platforms.join(','),
        );

        for (const image of options.images) {
            args.push('--tag', image);
        }

        args.push(...this.buildMetadataArgs(options), '--push');

        await this.runner.run(this.binary, args, { cwd: this.resolveContext(options.cwd) });
    }

    async tagImage(source: string, target: string) : Promise<void> {
        await this.runner.run(this.binary, ['tag', source, target]);
    }

    async pushImage(image: string) : Promise<void> {
        await this.runner.run(this.binary, ['push', image]);
    }

    async removeImage(image: string) : Promise<void> {
        await this.runner.run(this.binary, ['image', 'rm', '--force', image]);
    }

    protected async builderExists(name: string) : Promise<boolean> {
        try {
            await this.runner.run(this.binary, ['buildx', 'inspect', name]);

            return true;
        } catch (error) {
            // only a non-zero exit means missing, a failed spawn is rethrown
            if (error instanceof CommandError && error.result) {
                return false;
            }

            throw error;
        }
    }

    protected async createBuilder(name: string) : Promise<void> {
        // The builder is not made the current one (buildx use), so later
        // steps of the job keep building with whatever they used before.
        await this.runner.run(this.binary, [
            'buildx',
            'create',
            '--name',
            name,
            '--driver',
            'docker-container',
            '--bootstrap',
        ]);
    }

    protected buildMetadataArgs(options: Pick<ImageBuildOptions, 'labels' | 'buildArgs'>) : string[] {
        const args : string[] = [];

        if (options.labels) {
            for (const [key, value] of Object.entries(options.labels)) {
                args.push('--label', `${key}=${value}`);
            }
        }

        if (options.buildArgs) {
            if (Array.isArray(options.buildArgs)) {
                for (const buildArg of options.buildArgs) {
                    args.push('--build-arg', buildArg);
                }
            } else {
                for (const [key, value] of Object.entries(options.buildArgs)) {
                    args.push('--build-arg', `${key}=${value}`);
                }
            }
        }

        return args;
    }

    protected resolveContext(input: string) : string {
        const cwd = input || process.cwd();

        return path.isAbsolute(cwd) ? cwd : path.join(process.cwd(), cwd);
    }
}
