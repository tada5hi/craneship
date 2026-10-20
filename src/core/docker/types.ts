/*
 * Copyright (c) 2025-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type RegistryCredentials = {
    host: string,

    user: string,

    password: string
};

export type ImageBuildOptions = {
    /**
     * Tag the built image with this reference.
     */
    image: string,

    /**
     * Name of the Dockerfile, relative to cwd.
     */
    fileName: string,

    /**
     * Build context directory.
     */
    cwd: string,

    labels?: Record<string, string>,

    /**
     * Additional build args, either as KEY=VALUE strings or as a record.
     */
    buildArgs?: Record<string, string> | string[]
};

export type MultiPlatformBuildOptions = Omit<ImageBuildOptions, 'image'> & {
    /**
     * Every reference the image is pushed under.
     */
    images: string[],

    /**
     * Target platforms (e.g. linux/amd64, linux/arm64).
     */
    platforms: string[],

    /**
     * Builder to build with. The current builder, when omitted.
     */
    builder?: string
};

export type MultiPlatformBuilder = {
    /**
     * Name of the builder, when it is known.
     */
    name?: string,

    /**
     * Whether the builder was created for this build, as opposed to
     * an existing one being reused.
     */
    created: boolean
};

export interface IDockerClient {
    login(credentials: RegistryCredentials) : Promise<void>;

    logout(host: string) : Promise<void>;

    imageExists(image: string) : Promise<boolean>;

    buildImage(options: ImageBuildOptions) : Promise<void>;

    tagImage(source: string, target: string) : Promise<void>;

    pushImage(image: string) : Promise<void>;

    removeImage(image: string) : Promise<void>;

    /**
     * Find a builder which can build and push an image for several
     * platforms at once, creating one when none is available.
     */
    ensureMultiPlatformBuilder() : Promise<MultiPlatformBuilder>;

    removeBuilder(name: string) : Promise<void>;

    /**
     * Build an image for several platforms and push it under every
     * reference in one go. A multi-platform image cannot be loaded into
     * the local image store, so it is never tagged or pushed separately.
     */
    buildAndPushImage(options: MultiPlatformBuildOptions) : Promise<void>;
}
