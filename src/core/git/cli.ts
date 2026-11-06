/*
 * Copyright (c) 2025-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICommandRunner } from '../command/index.ts';
import type { GitCloneOptions, IGitClient } from './types.ts';

const CHARACTER_MAP : Record<string, string> = {
    '!': '%21',
    '#': '%23',
    $: '%24',
    '&': '%26',
    '\'': '%27',
    '(': '%28',
    ')': '%29',
    '*': '%2A',
    '+': '%2B',
    ',': '%2C',
    '/': '%2F',
    ':': '%3A',
    ';': '%3B',
    '=': '%3D',
    '?': '%3F',
    '@': '%40',
    '[': '%5B',
    ']': '%5D',
};

/**
 * Percent encode the characters which would otherwise terminate the
 * userinfo section of a clone url.
 */
export function escapeCredential(input: string) : string {
    let output = '';

    for (const character of input) {
        output += CHARACTER_MAP[character] || character;
    }

    return output;
}

/**
 * Inject basic auth credentials into an https clone url.
 */
export function buildCloneURL(url: string, user?: string, password?: string) : string {
    if (!user && !password) {
        return url;
    }

    const index = url.indexOf('://');

    if (index === -1) {
        return url;
    }

    const protocol = url.substring(0, index + 3);
    const rest = url.substring(index + 3);

    return `${protocol}${escapeCredential(user ?? '')}:${escapeCredential(password ?? '')}@${rest}`;
}

export class GitCLIClient implements IGitClient {
    protected runner : ICommandRunner;

    protected binary : string;

    constructor(runner: ICommandRunner, binary = 'git') {
        this.runner = runner;
        this.binary = binary;
    }

    async clone(options: GitCloneOptions) : Promise<void> {
        const args : string[] = ['clone'];

        if (options.branch) {
            args.push('--branch', options.branch);
        }

        args.push(buildCloneURL(options.url, options.user, options.password));
        args.push(options.directory);

        await this.runner.run(this.binary, args, { cwd: options.cwd });
    }
}
