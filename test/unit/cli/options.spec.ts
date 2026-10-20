import { describe, expect, it } from 'vitest';
import { buildOptionsFromArgs, toLines, toList } from '../../../src/cli/index.ts';

describe('src/cli/options.ts', () => {
    describe('toLines', () => {
        it('should split on newlines and trim', () => {
            expect(toLines('latest\n  1.2.3  \n\nedge')).toEqual(['latest', '1.2.3', 'edge']);
        });

        it('should split on carriage returns', () => {
            expect(toLines('FOO=bar\r\nBAZ=qux')).toEqual(['FOO=bar', 'BAZ=qux']);
        });

        it('should return an empty list for empty input', () => {
            expect(toLines('')).toEqual([]);
            expect(toLines(undefined)).toEqual([]);
        });
    });

    describe('toList', () => {
        it('should split on commas', () => {
            expect(toList('linux/amd64,linux/arm64')).toEqual(['linux/amd64', 'linux/arm64']);
        });

        it('should split on newlines and commas together and trim', () => {
            expect(toList(' linux/amd64 , linux/arm64\r\nlinux/arm/v7\n\n,')).toEqual([
                'linux/amd64',
                'linux/arm64',
                'linux/arm/v7',
            ]);
        });

        it('should return an empty list for empty input', () => {
            expect(toList('')).toEqual([]);
            expect(toList(undefined)).toEqual([]);
        });
    });

    describe('buildOptionsFromArgs', () => {
        it('should apply defaults for omitted args', () => {
            const options = buildOptionsFromArgs({});

            expect(options.dockerFileName).toBe('Dockerfile');
            expect(options.dockerFilePath).toBe('');
            expect(options.registryHost).toBe('ghcr.io');
            expect(options.serverUrl).toBe('https://github.com');
            expect(options.registryTags).toEqual(['latest']);
            expect(options.buildArgs).toEqual([]);
            expect(options.cleanup).toBe(true);
            expect(options.gitTag).toBe(true);
            expect(options.clone).toBe(false);
            expect(options.platforms).toEqual([]);
        });

        it('should split the platforms on commas and newlines', () => {
            const options = buildOptionsFromArgs({ platforms: 'linux/amd64,linux/arm64\nlinux/arm/v7' });

            expect(options.platforms).toEqual(['linux/amd64', 'linux/arm64', 'linux/arm/v7']);
        });

        it('should split the multi value args', () => {
            const options = buildOptionsFromArgs({
                registryTag: 'latest\n1.2.3',
                buildArgs: 'FOO=bar\nBAZ=qux',
            });

            expect(options.registryTags).toEqual(['latest', '1.2.3']);
            expect(options.buildArgs).toEqual(['FOO=bar', 'BAZ=qux']);
        });

        it('should accept booleans as parsed by citty', () => {
            const options = buildOptionsFromArgs({
                cleanup: false, 
                gitTag: false, 
                clone: true, 
            });

            expect(options.cleanup).toBe(false);
            expect(options.gitTag).toBe(false);
            expect(options.clone).toBe(true);
        });

        it('should accept booleans as strings', () => {
            const options = buildOptionsFromArgs({ cleanup: 'false', gitTag: 'true' });

            expect(options.cleanup).toBe(false);
            expect(options.gitTag).toBe(true);
        });

        it('should omit the run labels when they are empty', () => {
            const options = buildOptionsFromArgs({});

            expect(options.runId).toBeUndefined();
            expect(options.runNumber).toBeUndefined();
        });

        it('should keep the run labels when they are set', () => {
            const options = buildOptionsFromArgs({ runId: 42, runNumber: '7' });

            expect(options.runId).toBe('42');
            expect(options.runNumber).toBe('7');
        });

        it('should pass the registry and git credentials through', () => {
            const options = buildOptionsFromArgs({
                registryHost: 'docker.io',
                registryUser: 'tada5hi',
                registryPassword: 'some-registry-password',
                registryRepository: 'tada5hi/some-repo',
                gitUser: 'tada5hi',
                gitPassword: 'some-password',
                gitTagPrefix: 'some-package',
                ref: 'refs/tags/v1.2.3',
                repository: 'tada5hi/some-repo',
                root: '/workspace',
            });

            expect(options).toMatchObject({
                registryHost: 'docker.io',
                registryUser: 'tada5hi',
                registryPassword: 'some-registry-password',
                registryRepository: 'tada5hi/some-repo',
                gitUser: 'tada5hi',
                gitPassword: 'some-password',
                gitTagPrefix: 'some-package',
                ref: 'refs/tags/v1.2.3',
                repository: 'tada5hi/some-repo',
                root: '/workspace',
            });
        });
    });
});
