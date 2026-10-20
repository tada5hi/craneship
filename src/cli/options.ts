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
    DEFAULT_REGISTRY_TAG,
    DEFAULT_SERVER_URL,
} from '../constants.ts';
import type { Options } from '../types.ts';
import { toBoolean } from '../utils/index.ts';

export type PublishCommandArgs = Record<string, unknown>;

function toStringValue(input: unknown, fallback = '') : string {
    if (typeof input === 'string') {
        return input;
    }

    if (typeof input === 'number') {
        return `${input}`;
    }

    return fallback;
}

function toBooleanValue(input: unknown, fallback: boolean) : boolean {
    return toBoolean(input) ?? fallback;
}

/**
 * Split a newline separated multi value input, as used by the
 * registryTag and buildArgs action inputs.
 */
export function toLines(input: unknown) : string[] {
    return toStringValue(input)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

/**
 * Split a comma or newline separated multi value input, as used by the
 * platforms action input.
 */
export function toList(input: unknown) : string[] {
    return toStringValue(input)
        .split(/[\r\n,]+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

export function buildOptionsFromArgs(args: PublishCommandArgs) : Options {
    const registryTags = toLines(args.registryTag);
    if (registryTags.length === 0) {
        registryTags.push(DEFAULT_REGISTRY_TAG);
    }

    const runId = toStringValue(args.runId);
    const runNumber = toStringValue(args.runNumber);

    return {
        dockerFileName: toStringValue(args.dockerFileName) || DEFAULT_DOCKER_FILE_NAME,
        dockerFilePath: toStringValue(args.dockerFilePath),
        buildArgs: toLines(args.buildArgs),
        cleanup: toBooleanValue(args.cleanup, true),
        clone: toBooleanValue(args.clone, false),
        platforms: toList(args.platforms),

        gitTag: toBooleanValue(args.gitTag, true),
        gitTagPrefix: toStringValue(args.gitTagPrefix),
        gitUser: toStringValue(args.gitUser),
        gitPassword: toStringValue(args.gitPassword),

        registryHost: toStringValue(args.registryHost) || DEFAULT_REGISTRY_HOST,
        registryUser: toStringValue(args.registryUser),
        registryPassword: toStringValue(args.registryPassword),
        registryRepository: toStringValue(args.registryRepository),
        registryTags,

        ref: toStringValue(args.ref),
        repository: toStringValue(args.repository),
        serverUrl: toStringValue(args.serverUrl) || DEFAULT_SERVER_URL,
        ...(runId.length > 0 ? { runId } : {}),
        ...(runNumber.length > 0 ? { runNumber } : {}),

        root: toStringValue(args.root) || process.cwd(),
    };
}
