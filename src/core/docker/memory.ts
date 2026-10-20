/*
 * Copyright (c) 2025-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { DOCKER_BUILDER_NAME } from './constants.ts';
import type {
    IDockerClient,
    ImageBuildOptions,
    MultiPlatformBuildOptions,
    MultiPlatformBuilder,
    MultiPlatformBuilderOptions,
    RegistryCredentials,
} from './types.ts';

/**
 * In memory docker client, tracking the images it was told about
 * so the orchestrator can be exercised without a docker daemon.
 */
export class MemoryDockerClient implements IDockerClient {
    readonly images : Set<string> = new Set();

    readonly builds : ImageBuildOptions[] = [];

    readonly pushed : string[] = [];

    readonly removed : string[] = [];

    readonly logins : RegistryCredentials[] = [];

    readonly logouts : string[] = [];

    readonly builders : Set<string> = new Set();

    readonly createdBuilders : string[] = [];

    readonly removedBuilders : string[] = [];

    readonly multiPlatformBuilds : MultiPlatformBuildOptions[] = [];

    /**
     * @param images images the daemon already holds
     * @param builders multi-platform builders which already exist
     */
    constructor(images: string[] = [], builders: string[] = []) {
        for (const image of images) {
            this.images.add(image);
        }

        for (const builder of builders) {
            this.builders.add(builder);
        }
    }

    async login(credentials: RegistryCredentials) : Promise<void> {
        this.logins.push(credentials);
    }

    async logout(host: string) : Promise<void> {
        this.logouts.push(host);
    }

    async imageExists(image: string) : Promise<boolean> {
        return this.images.has(image);
    }

    async buildImage(options: ImageBuildOptions) : Promise<void> {
        this.builds.push(options);
        this.images.add(options.image);
    }

    async tagImage(source: string, target: string) : Promise<void> {
        if (!this.images.has(source)) {
            throw new Error(`The image ${source} does not exist.`);
        }

        this.images.add(target);
    }

    async pushImage(image: string) : Promise<void> {
        if (!this.images.has(image)) {
            throw new Error(`The image ${image} does not exist.`);
        }

        this.pushed.push(image);
    }

    async removeImage(image: string) : Promise<void> {
        this.images.delete(image);
        this.removed.push(image);
    }

    async ensureMultiPlatformBuilder(options: MultiPlatformBuilderOptions) : Promise<MultiPlatformBuilder> {
        if (options.shared && this.builders.has(DOCKER_BUILDER_NAME)) {
            return { name: DOCKER_BUILDER_NAME, created: false };
        }

        // a private builder is named per run, numbered here to stay predictable
        const name = options.shared ?
            DOCKER_BUILDER_NAME :
            `${DOCKER_BUILDER_NAME}-${this.createdBuilders.length + 1}`;

        this.builders.add(name);
        this.createdBuilders.push(name);

        return { name, created: true };
    }

    async removeBuilder(name: string) : Promise<void> {
        if (!this.builders.has(name)) {
            throw new Error(`The builder ${name} does not exist.`);
        }

        this.builders.delete(name);
        this.removedBuilders.push(name);
    }

    async buildAndPushImage(options: MultiPlatformBuildOptions) : Promise<void> {
        if (options.builder && !this.builders.has(options.builder)) {
            throw new Error(`The builder ${options.builder} does not exist.`);
        }

        // pushed straight from the build: a multi-platform image never
        // reaches the local image set, so it cannot be tagged or pushed later
        this.multiPlatformBuilds.push(options);
        this.pushed.push(...options.images);
    }
}
