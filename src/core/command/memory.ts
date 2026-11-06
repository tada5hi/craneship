/*
 * Copyright (c) 2025-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { CommandError } from './error.ts';
import type {
    CommandOptions,
    CommandResult,
    ICommandRunner,
} from './types.ts';

import type { MemoryCommandCall, MemoryCommandResponse } from './types';





/**
 * In memory command runner, recording every invocation instead of
 * spawning a process. Responses can be scripted per command prefix.
 */
export class MemoryCommandRunner implements ICommandRunner {
    readonly calls : MemoryCommandCall[] = [];

    protected responses : Map<string, MemoryCommandResponse> = new Map();

    /**
     * Script the result of the next matching invocation.
     *
     * @param prefix e.g. "docker images", matched against `${command} ${args.join(' ')}`
     */
    respondTo(prefix: string, response: MemoryCommandResponse) : this {
        this.responses.set(prefix, response);

        return this;
    }

    /**
     * The recorded invocations, flattened to plain command lines.
     */
    get commandLines() : string[] {
        return this.calls.map((call) => [call.command, ...call.args].join(' '));
    }

    async run(command: string, args: string[], options: CommandOptions = {}) : Promise<CommandResult> {
        this.calls.push({
            command,
            args,
            options,
        });

        const line = [command, ...args].join(' ');

        let response : MemoryCommandResponse | undefined;

        for (const [prefix, value] of this.responses) {
            if (line.startsWith(prefix)) {
                response = value;

                break;
            }
        }

        const result : CommandResult = {
            stdout: response?.stdout ?? '',
            stderr: response?.stderr ?? '',
            code: response?.code ?? 0,
        };

        if (result.code !== 0) {
            throw CommandError.exitedNonZero(command, args, result);
        }

        return result;
    }
}
export type { MemoryCommandCall, MemoryCommandResponse };
