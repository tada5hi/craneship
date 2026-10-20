import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { CommandError, NodeCommandRunner } from '../../../../src/core/index.ts';

/**
 * The node binary running the tests doubles as the subject under test,
 * so these specs spawn real processes without depending on a shell.
 */
const NODE = process.execPath;

describe('src/core/command/node.ts', () => {
    it('should capture stdout', async () => {
        const runner = new NodeCommandRunner();

        const result = await runner.run(NODE, ['-e', 'process.stdout.write("hello")']);

        expect(result.stdout).toBe('hello');
        expect(result.code).toBe(0);
    });

    it('should capture stderr', async () => {
        const runner = new NodeCommandRunner();

        const result = await runner.run(NODE, ['-e', 'process.stderr.write("oops")']);

        expect(result.stderr).toBe('oops');
    });

    it('should write stdin to the process', async () => {
        const runner = new NodeCommandRunner();

        const result = await runner.run(
            NODE,
            ['-e', 'process.stdin.pipe(process.stdout)'],
            { stdin: 'from-stdin' },
        );

        expect(result.stdout).toBe('from-stdin');
    });

    it('should not go through a shell', async () => {
        const runner = new NodeCommandRunner();

        // a shell would expand this into two arguments
        const result = await runner.run(NODE, ['-e', 'process.stdout.write(process.argv[1] ?? "")', 'a b']);

        expect(result.stdout).toBe('a b');
    });

    it('should run in the given working directory', async () => {
        const runner = new NodeCommandRunner();

        const result = await runner.run(
            NODE,
            ['-e', 'process.stdout.write(process.cwd())'],
            { cwd: process.cwd() },
        );

        expect(result.stdout).toBe(process.cwd());
    });

    it('should stream output while it runs', async () => {
        const chunks : string[] = [];
        const runner = new NodeCommandRunner({
            stream: (chunk) => {
                chunks.push(chunk);
            },
        });

        await runner.run(NODE, ['-e', 'process.stdout.write("streamed")']);

        expect(chunks.join('')).toContain('streamed');
    });

    it('should reject on a non zero exit code', async () => {
        const runner = new NodeCommandRunner();

        await expect(runner.run(NODE, ['-e', 'process.stderr.write("bad"); process.exit(3)']))
            .rejects.toThrow(/exit code 3/);
    });

    it('should expose the result on the error', async () => {
        const runner = new NodeCommandRunner();

        const error = await runner
            .run(NODE, ['-e', 'process.exit(2)'])
            .catch((err : unknown) => err);

        expect(error).toBeInstanceOf(CommandError);
        expect((error as CommandError).result?.code).toBe(2);
        expect((error as CommandError).command).toBe(NODE);
    });

    it('should reject when the binary does not exist', async () => {
        const runner = new NodeCommandRunner();

        await expect(runner.run('some-binary-which-does-not-exist', []))
            .rejects.toThrow(/could not be spawned/);
    });
});
