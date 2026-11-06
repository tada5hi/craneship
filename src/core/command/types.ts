/*
 * Copyright (c) 2025-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */





export type CommandOptions = {
    /**
     * Working directory to run the command in.
     */
    cwd?: string,

    /**
     * Data to write to the stdin of the spawned process.
     */
    stdin?: string
};

export type CommandResult = {
    stdout: string,

    stderr: string,

    code: number
};

export interface ICommandRunner {
    /**
     * Run a command with an explicit argument vector.
     *
     * Arguments are passed to the process directly, never through a shell,
     * so no caller has to escape or quote them.
     */
    run(command: string, args: string[], options?: CommandOptions) : Promise<CommandResult>;
}

export type MemoryCommandCall = {
    command: string,

    args: string[],

    options: CommandOptions
};

export type MemoryCommandResponse = Partial<CommandResult>;

export type NodeCommandRunnerOptions = {
    /**
     * Mirror stdout/stderr of the spawned process while it runs.
     */
    stream?: (chunk: string) => void
};
