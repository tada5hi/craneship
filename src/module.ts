/*
 * Copyright (c) 2022-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import md5 from 'md5';
import path from 'node:path';
import { buildDockerImageURL } from './core/index.ts';
import type { ImageBuildOptions } from './core/index.ts';
import type {
    GithubRef,
    Options,
    PublishContext,
    PublishResult,
} from './types.ts';
import {
    cleanDoubleSlashes,
    parseGitHubRef,
    trimRefName,
} from './utils/index.ts';

const CLONE_DIRECTORY = '.output';

type BuildInput = Omit<ImageBuildOptions, 'image'>;

type PublishInput = {
    imageId: string,

    images: string[],

    build: BuildInput
};

function deriveTags(options: Options, ref: GithubRef) : string[] {
    const tags : string[] = [];

    // an image tag derived from the git tag
    if (
        options.gitTag &&
        ref.type === 'tag' &&
        (
            options.gitTagPrefix.length === 0 ||
            ref.value.startsWith(options.gitTagPrefix)
        )
    ) {
        tags.push(trimRefName(ref.value, options.gitTagPrefix));
    }

    // the explicitly requested image tags
    if (
        ref.type !== 'tag' ||
        !options.gitTag ||
        options.registryTags.length > 0
    ) {
        tags.push(...options.registryTags);
    }

    return tags;
}

/**
 * Build once with a plain docker build, then tag and push the local image
 * under every reference.
 */
async function publishSinglePlatform(
    options: Options,
    context: PublishContext,
    input: PublishInput,
) : Promise<PublishResult> {
    const { docker, logger } = context;
    const {
        imageId, 
        images, 
        build, 
    } = input;

    const imageExists = await docker.imageExists(imageId);

    await docker.login({
        host: options.registryHost,
        user: options.registryUser,
        password: options.registryPassword,
    });

    const result : PublishResult = {
        imageId,
        built: false,
        images: [],
    };

    try {
        if (!imageExists) {
            logger.info('Image does not exist.');

            await docker.buildImage({ ...build, image: imageId });

            result.built = true;
        }

        for (const image of images) {
            logger.info(`Tagging image ${imageId} with ${image}`);
            await docker.tagImage(imageId, image);

            logger.info(`Pushing image ${image}`);
            await docker.pushImage(image);

            await docker.removeImage(image);

            result.images.push(image);
        }

        if (options.cleanup) {
            logger.info('Deleting built image...');
            await docker.removeImage(imageId);
        }
    } finally {
        await docker.logout(options.registryHost);
    }

    return result;
}

/**
 * Build for every platform with docker buildx and push every reference
 * straight from that build. A multi-platform image cannot be loaded into
 * the local daemon, so there is no local image to tag, push or remove.
 */
async function publishMultiPlatform(
    options: Options,
    context: PublishContext,
    input: PublishInput & { platforms: string[] },
) : Promise<PublishResult> {
    const { docker, logger } = context;
    const {
        imageId,
        images,
        build,
        platforms,
    } = input;

    const result : PublishResult = {
        imageId,
        built: false,
        images: [],
    };

    // buildx refuses to push without a tag, and a build nobody can pull
    // afterwards is wasted work
    if (images.length === 0) {
        logger.warn('No image tag was derived from the ref, skipping the build.');

        return result;
    }

    await docker.login({
        host: options.registryHost,
        user: options.registryUser,
        password: options.registryPassword,
    });

    try {
        // cleanup removes the builder again, so it is private to this run;
        // otherwise it is shared, and later runs reuse it with its cache
        const builder = await docker.ensureMultiPlatformBuilder({ shared: !options.cleanup });

        let buildFailed = false;
        let buildError : unknown;

        try {
            logger.info(`Building for ${platforms.join(', ')} and pushing ${images.join(', ')}`);

            await docker.buildAndPushImage({
                ...build,
                images,
                platforms,
                ...(builder.name ? { builder: builder.name } : {}),
            });

            result.built = true;
            result.images.push(...images);
        } catch (error) {
            buildFailed = true;
            buildError = error;
        }

        // cleanup removes what this run left behind: the builder it
        // created (with its build cache), never one it found
        if (options.cleanup && builder.created && builder.name) {
            logger.info(`Removing builder ${builder.name}...`);

            try {
                await docker.removeBuilder(builder.name);
            } catch (error) {
                // a failing removal must not replace the build error,
                // which is the one worth reporting
                if (!buildFailed) {
                    throw error;
                }

                const message = error instanceof Error ? error.message : `${error}`;
                logger.warn(`The builder ${builder.name} could not be removed: ${message}`);
            }
        }

        if (buildFailed) {
            throw buildError;
        }
    } finally {
        await docker.logout(options.registryHost);
    }

    return result;
}

export async function publish(
    options: Options,
    context: PublishContext,
) : Promise<PublishResult> {
    const { git, logger } = context;

    logger.info('Booting...');

    const ref = parseGitHubRef(options.ref);
    if (!ref) {
        throw new Error(`The git ref ${options.ref} could not be parsed.`);
    }

    // On a runner the repository is already checked out at this ref, so the
    // build context is the working directory. Cloning is for standalone use,
    // where there is no checkout to build from.
    let source = options.root;

    if (options.clone) {
        logger.info('Cloning repository...');

        await git.clone({
            url: cleanDoubleSlashes(`${options.serverUrl}/${options.repository}`),
            directory: CLONE_DIRECTORY,
            cwd: options.root,
            // --branch takes a tag name just as well as a branch name. Passing
            // it for tags is what pins the clone to the tagged commit instead
            // of leaving it on the default branch.
            branch: ref.type === 'pull' ? undefined : ref.value,
            user: options.gitUser,
            password: options.gitPassword,
        });

        source = path.join(options.root, CLONE_DIRECTORY);
    }

    const imageId = md5(options.ref);

    const imageBase = cleanDoubleSlashes(
        `${options.registryHost}/${options.registryRepository}`,
    ).toLowerCase();

    const images = deriveTags(options, ref)
        .map((tag) => buildDockerImageURL(imageBase, tag));

    let cwd = source;
    if (options.dockerFilePath.length > 0) {
        cwd = path.join(cwd, options.dockerFilePath);
    }

    const labels : Record<string, string> = {};
    if (options.runId) {
        labels.runId = options.runId;
    }
    if (options.runNumber) {
        labels.runNumber = options.runNumber;
    }

    const build : BuildInput = {
        fileName: options.dockerFileName,
        cwd,
        labels,
        buildArgs: options.buildArgs,
    };

    const platforms = options.platforms ?? [];

    const result = platforms.length > 0 ?
        await publishMultiPlatform(options, context, {
            imageId,
            images,
            build,
            platforms,
        }) :
        await publishSinglePlatform(options, context, {
            imageId,
            images,
            build,
        });

    logger.info('Finished.');

    return result;
}
