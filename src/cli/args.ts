/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import process from 'node:process';
import {
    DEFAULT_DOCKER_FILE_NAME,
    DEFAULT_REGISTRY_HOST,
    DEFAULT_SERVER_URL,
} from '../constants.ts';

/**
 * Defaults are sourced from the environment variables GitHub Actions
 * already provides, so the CLI needs no flags at all inside a workflow.
 */
export const PUBLISH_COMMAND_ARGS = {
    dockerFileName: {
        type: 'string',
        description: 'Name of the Dockerfile.',
        default: DEFAULT_DOCKER_FILE_NAME,
    },
    dockerFilePath: {
        type: 'string',
        description: 'Relative path to the Dockerfile.',
        default: '',
    },
    buildArgs: {
        type: 'string',
        description: 'Additional docker build args (KEY=VALUE), newline separated.',
        default: '',
    },
    cleanup: {
        type: 'boolean',
        description: 'Delete the built image at the end.',
        default: true,
    },
    clone: {
        type: 'boolean',
        description: 'Clone the repository at the ref instead of building the working directory.',
        default: false,
    },
    platforms: {
        type: 'string',
        description: 'Target platforms (e.g. linux/amd64,linux/arm64), comma or newline separated. Builds with docker buildx and pushes from the build.',
        default: '',
    },
    gitTag: {
        type: 'boolean',
        description: 'Create an image tag for a git tag.',
        default: true,
    },
    gitTagPrefix: {
        type: 'string',
        description: 'Only match git tags with this prefix.',
        default: '',
    },
    gitUser: {
        type: 'string',
        description: 'User for cloning the repository.',
        default: process.env.GITHUB_ACTOR ?? '',
    },
    gitPassword: {
        type: 'string',
        description: 'Password/token for cloning the repository.',
        default: process.env.GITHUB_TOKEN ?? '',
    },
    registryHost: {
        type: 'string',
        description: 'Registry host.',
        default: DEFAULT_REGISTRY_HOST,
    },
    registryUser: {
        type: 'string',
        description: 'Registry user.',
        default: process.env.GITHUB_ACTOR ?? '',
    },
    registryPassword: {
        type: 'string',
        description: 'Registry password.',
        default: process.env.GITHUB_TOKEN ?? '',
    },
    registryRepository: {
        type: 'string',
        description: 'Registry repository full name (e.g. project/repository).',
        default: process.env.GITHUB_REPOSITORY ?? '',
    },
    registryTag: {
        type: 'string',
        description: 'Registry image tags (e.g. latest), newline separated.',
        default: '',
    },
    ref: {
        type: 'string',
        description: 'The git ref to publish (e.g. refs/tags/v1.2.3).',
        default: process.env.GITHUB_REF ?? '',
    },
    repository: {
        type: 'string',
        description: 'Repository full name (e.g. owner/repository).',
        default: process.env.GITHUB_REPOSITORY ?? '',
    },
    serverUrl: {
        type: 'string',
        description: 'Base url of the git server.',
        default: process.env.GITHUB_SERVER_URL || DEFAULT_SERVER_URL,
    },
    runId: {
        type: 'string',
        description: 'Applied as an image label.',
        default: process.env.GITHUB_RUN_ID ?? '',
    },
    runNumber: {
        type: 'string',
        description: 'Applied as an image label.',
        default: process.env.GITHUB_RUN_NUMBER ?? '',
    },
    root: {
        type: 'string',
        description: 'Directory the repository is cloned into.',
        default: process.cwd(),
    },
} as const;
