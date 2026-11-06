/*
 * Copyright (c) 2022-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */



import type { ImageUrlBuildContext } from './types';

export function buildDockerImageURL(context: ImageUrlBuildContext) : string;
export function buildDockerImageURL(image: string, tag?: string) : string;
export function buildDockerImageURL(context: ImageUrlBuildContext | string, tag?: string) : string {
    let base : string;

    if (typeof context === 'string') {
        base = context;
    } else {
        base = `${context.host}/${context.owner}/${context.name}`;
        tag = context.tag;
    }

    const name = base.split('/').pop() ?? base;

    // the reference already carries a tag or a digest
    if (name.includes(':') || name.includes('@')) {
        return base;
    }

    if (!tag) {
        return base;
    }

    return base + (tag.startsWith('sha') ?
        `@${tag}` :
        `:${tag}`);
}
export type { ImageUrlBuildContext };
