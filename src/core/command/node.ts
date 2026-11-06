/*
 * Copyright (c) 2025-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { spawn } from 'node:child_process';
import { CommandError } from './error.ts';
import type {
    CommandOptions,
    CommandResult,
    ICommandRunner,
} from './types.ts';

import type { NodeCommandRunnerOptions } from './types';



export class NodeCommandRunner implements ICommandRunner {
    protected options : NodeCommandRunnerOptions;

    constructor(options: NodeCommandRunnerOptions = {}) {
        this.options = options;
    }

    run(command: string, args: string[], options: CommandOptions = {}) : Promise<CommandResult> {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                cwd: options.cwd,
                env: process.env,
                stdio: [
                    typeof options.stdin === 'string' ? 'pipe' : 'ignore',
                    'pipe',
                    'pipe',
                ],
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.setEncoding('utf8');
            child.stdout?.on('data', (chunk: string) => {
                stdout += chunk;
                this.options.stream?.(chunk);
            });

            child.stderr?.setEncoding('utf8');
            child.stderr?.on('data', (chunk: string) => {
                stderr += chunk;
                this.options.stream?.(chunk);
            });

            child.on('error', (error) => {
                reject(CommandError.spawnFailed(command, args, error));
            });

            child.on('close', (code) => {
                const result : CommandResult = {
                    stdout,
                    stderr,
                    code: code ?? 0,
                };

                if (result.code === 0) {
                    resolve(result);
                } else {
                    reject(CommandError.exitedNonZero(command, args, result));
                }
            });

            if (typeof options.stdin === 'string') {
                child.stdin?.end(options.stdin);
            }
        });
    }
}
export type { NodeCommandRunnerOptions };
