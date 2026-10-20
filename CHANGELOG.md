# [3.3.0](https://github.com/tada5hi/action-docker-image-publish/compare/v3.2.0...v3.3.0) (2025-03-06)


### Bug Fixes

* add missing semver types dependency ([7ecbe04](https://github.com/tada5hi/action-docker-image-publish/commit/7ecbe0449c4067d369facec552bb7c4dc25b8148))
* **deps:** bump the minorandpatch group with 14 updates ([#128](https://github.com/tada5hi/action-docker-image-publish/issues/128)) ([910925a](https://github.com/tada5hi/action-docker-image-publish/commit/910925accfad5eb9b3b2acb41ba11e54313c7d82))
* **deps:** dump @tada5hi/semantic-release ([293a35e](https://github.com/tada5hi/action-docker-image-publish/commit/293a35ef4b230c542d3c421343fd1db8fc4cd23a))
* package.json repository url for semantic release ([de762de](https://github.com/tada5hi/action-docker-image-publish/commit/de762def8ef93fb9353a3cf7917d76732474d89c))
* replace 'assert' with 'with' keywoard ([7ca5424](https://github.com/tada5hi/action-docker-image-publish/commit/7ca5424e8b46d328890ea3190184abca95b9d976))
* repository name in package.json ([d2f0b37](https://github.com/tada5hi/action-docker-image-publish/commit/d2f0b3770310eafce67bbf083e1cd8f1ccfe8041))


### Features

* dump node version in Dockerfile ([54e7acb](https://github.com/tada5hi/action-docker-image-publish/commit/54e7acbc74d901bb456ed7aa7fbee137697cb1dc))

# [3.2.0](https://github.com/Tada5hi/action-docker-release/compare/v3.1.0...v3.2.0) (2023-11-15)


### Features

* escape git token/password ([4c17479](https://github.com/Tada5hi/action-docker-release/commit/4c17479b4a7f6f03eab831aefb3e30f766492997))
* specifiy git user & password for cloning repository ([4ac64f1](https://github.com/Tada5hi/action-docker-release/commit/4ac64f1d737cd98dd53ae3e1d0cee0c3153f7c78))

# [3.1.0](https://github.com/Tada5hi/action-docker-release/compare/v3.0.1...v3.1.0) (2023-11-05)


### Bug Fixes

* clone github address ([49574ab](https://github.com/Tada5hi/action-docker-release/commit/49574ab5f5e629c99ab0aa7eb2c93cdb3b2379f6))
* install git in container ([79987f8](https://github.com/Tada5hi/action-docker-release/commit/79987f84aa5c70280ab43c0d93f85d0736a092f9))


### Features

* clone repo in output directory ([6286c63](https://github.com/Tada5hi/action-docker-release/commit/6286c6378934f2b019e7988f9f77b537dd850937))

## [4.1.0](https://github.com/tada5hi/craneship/compare/v4.0.0...v4.1.0) (2026-10-20)


### Features

* build multi-platform images with docker buildx ([#188](https://github.com/tada5hi/craneship/issues/188)) ([1c0232b](https://github.com/tada5hi/craneship/commit/1c0232b0ac6535d84614d915a70bee75a19b5b77))

## [4.0.0](https://github.com/tada5hi/dimp/compare/v3.4.0...v4.0.0) (2026-08-04)


### ⚠ BREAKING CHANGES

* the action builds the checked out workspace, so workflows must run actions/checkout first. Workflows which relied on the implicit clone should set "clone: true".
* the npm package is now published as "dimp" and the binary is "dimp" rather than "action-docker-image-publish". The old npm package stays frozen at 3.4.0. GitHub redirects the old repository path, so
* action.yml is a composite action instead of a docker action, so it no longer builds a container image of itself before doing any work. The Dockerfile and the container image published to ghcr are gone with it; use npx action-docker-image-publish instead. The unused "token" input is deprecated and "node-version" was added.

### Features

* build the workspace by default, make cloning opt-in ([680bffb](https://github.com/tada5hi/dimp/commit/680bffba50889c09880ad312dba9e4fcb66ba919))
* rename the project to dimp ([49ea54c](https://github.com/tada5hi/dimp/commit/49ea54c6359b53dfc0404430acd825188fc5b069))
* restructure as library, citty cli and composite action ([2d98f16](https://github.com/tada5hi/dimp/commit/2d98f16196b2e75202ffc8c125341088fe4fbc64))

## [3.4.0](https://github.com/tada5hi/action-docker-image-publish/compare/v3.3.0...v3.4.0) (2025-08-08)


### Features

* allow passing build args ([339928b](https://github.com/tada5hi/action-docker-image-publish/commit/339928b92ba307b919f10ed4cdf2eb920131dea5))

## [3.0.1](https://github.com/Tada5hi/action-docker-release/compare/v3.0.0...v3.0.1) (2023-11-01)


### Bug Fixes

* remove unused dependencies + merge release-config plugins ([5021d81](https://github.com/Tada5hi/action-docker-release/commit/5021d8182c13b4aaaf829d2f370dd06adcf9362a))

## [2.1.1](https://github.com/Tada5hi/action-docker-release/compare/v2.1.0...v2.1.1) (2023-11-01)


### Bug Fixes

* dockerfile command ([afe86a4](https://github.com/Tada5hi/action-docker-release/commit/afe86a46842055b1d0eacd1f42f0947fe007f410))

# [2.1.0](https://github.com/Tada5hi/action-docker-release/compare/v2.0.2...v2.1.0) (2023-11-01)


### Features

* execute action in docker container ([b1e2160](https://github.com/Tada5hi/action-docker-release/commit/b1e2160b4082a77da3911413c53fc140c25dc265))

## [2.0.2](https://github.com/Tada5hi/action-docker-release/compare/v2.0.1...v2.0.2) (2023-10-25)


### Bug Fixes

* add missign await for image check ([e4147ff](https://github.com/Tada5hi/action-docker-release/commit/e4147ff6c829ae36fd7462265ae8b64a2dafe3d6))
* enhance log message format ([d55885d](https://github.com/Tada5hi/action-docker-release/commit/d55885daff61978fb0f4cba7186372a048ad5482))

## [2.0.1](https://github.com/Tada5hi/action-docker-release/compare/v2.0.0...v2.0.1) (2023-10-25)


### Bug Fixes

* node version range in action.yml ([3b0ebb3](https://github.com/Tada5hi/action-docker-release/commit/3b0ebb378b7c0401c396b3618bf51d85474ea3ba))

# [2.0.0](https://github.com/Tada5hi/action-docker-release/compare/v1.9.0...v2.0.0) (2023-10-25)


### Features

* simplified action & use async instead of sync process execution ([1f6ec0e](https://github.com/Tada5hi/action-docker-release/commit/1f6ec0e45683e120427d553ad9bf6faa8262c8bf))


### BREAKING CHANGES

* options & execution changed

# [1.9.0](https://github.com/Tada5hi/action-docker-release/compare/v1.8.0...v1.9.0) (2023-10-24)


### Features

* implement get multiline input ([7e9d483](https://github.com/Tada5hi/action-docker-release/commit/7e9d48323b498855c2573b7f00258cf76ad5ac56))

# [1.8.0](https://github.com/Tada5hi/action-docker-release/compare/v1.7.2...v1.8.0) (2023-10-24)


### Features

* allow multiple tags & update dependencies ([1b0b6b9](https://github.com/Tada5hi/action-docker-release/commit/1b0b6b9237a0fd79e8076e1558521e99f9130169))

## [1.7.2](https://github.com/Tada5hi/action-docker-release/compare/v1.7.1...v1.7.2) (2023-01-07)


### Bug Fixes

* add missing option in action.yml ([b27ab9b](https://github.com/Tada5hi/action-docker-release/commit/b27ab9b95aadd68bfb9976236656b4fc62cbecbd))

## [1.7.1](https://github.com/Tada5hi/action-docker-release/compare/v1.7.0...v1.7.1) (2023-01-07)


### Bug Fixes

* docker image-id building ([3138b41](https://github.com/Tada5hi/action-docker-release/commit/3138b41411bb0c40609fc1cef13d2fba450272f4))

# [1.7.0](https://github.com/Tada5hi/action-docker-release/compare/v1.6.5...v1.7.0) (2023-01-07)


### Features

* add cache support ([6fd29a9](https://github.com/Tada5hi/action-docker-release/commit/6fd29a982bfb531f71878e2e0b6603e8de7621e0))

## [1.6.5](https://github.com/Tada5hi/action-docker-release/compare/v1.6.4...v1.6.5) (2023-01-04)


### Bug Fixes

* **deps:** bump json5 from 1.0.1 to 1.0.2 ([b4194e3](https://github.com/Tada5hi/action-docker-release/commit/b4194e3edc4fad0c2b41cba6ea2730e2a31206ec))

## [1.6.4](https://github.com/Tada5hi/action-docker-release/compare/v1.6.3...v1.6.4) (2022-12-26)


### Bug Fixes

* move type to other directory ([c6d5875](https://github.com/Tada5hi/action-docker-release/commit/c6d5875613132515a70638f6b254b824a8e5f50c))

## [1.6.3](https://github.com/Tada5hi/action-docker-release/compare/v1.6.2...v1.6.3) (2022-12-26)


### Bug Fixes

* enhance ref-name trimming for monorepo tags ([bf783e4](https://github.com/Tada5hi/action-docker-release/commit/bf783e4f0ea6eaa986b45007940a1d8bf59c54ec))

## [1.6.2](https://github.com/Tada5hi/action-docker-release/compare/v1.6.1...v1.6.2) (2022-12-26)


### Bug Fixes

* trim ref name for docker image ([f2c7861](https://github.com/Tada5hi/action-docker-release/commit/f2c7861d6453119a96115bdfd3f6fe5efd2a06d8))

## [1.6.1](https://github.com/Tada5hi/action-docker-release/compare/v1.6.0...v1.6.1) (2022-12-26)


### Bug Fixes

* ignores option building ([9b9fd67](https://github.com/Tada5hi/action-docker-release/commit/9b9fd673aa5222d0ca19d16515e813ac449b8e24))

# [1.6.0](https://github.com/Tada5hi/action-docker-release/compare/v1.5.1...v1.6.0) (2022-12-26)


### Features

* better control for git tag trigger ([2d80473](https://github.com/Tada5hi/action-docker-release/commit/2d8047392b5a113607678212a8777c592975352a))

## [1.5.1](https://github.com/Tada5hi/action-docker-release/compare/v1.5.0...v1.5.1) (2022-12-26)


### Bug Fixes

* github input parsing ([5713c12](https://github.com/Tada5hi/action-docker-release/commit/5713c12b8f573ed422781796fc1d1d6b52045e01))

# [1.5.0](https://github.com/Tada5hi/action-docker-release/compare/v1.4.1...v1.5.0) (2022-12-26)


### Features

* parse git ref for better decision making ([b446fa6](https://github.com/Tada5hi/action-docker-release/commit/b446fa6bd167e56343a5784c5976effe41341ab6))

## [1.4.1](https://github.com/Tada5hi/action-docker-release/compare/v1.4.0...v1.4.1) (2022-12-26)


### Bug Fixes

* add precondition for commit range check ([7a839ff](https://github.com/Tada5hi/action-docker-release/commit/7a839ffe3efde3479fd9196703e94e65552c32bb))
* transform repository name to lower case ([c380d0d](https://github.com/Tada5hi/action-docker-release/commit/c380d0d2e445abea615fbed9d79ea560d0cf4da3))

# [1.4.0](https://github.com/Tada5hi/action-docker-release/compare/v1.3.0...v1.4.0) (2022-12-26)


### Features

* allow disabling version file ([3f137e8](https://github.com/Tada5hi/action-docker-release/commit/3f137e8279dba7ec899eb0b185e46956ac659477))

# [1.3.0](https://github.com/Tada5hi/action-docker-release/compare/v1.2.0...v1.3.0) (2022-12-26)


### Bug Fixes

* better commit detection for related package release ([ac6d43c](https://github.com/Tada5hi/action-docker-release/commit/ac6d43c6c4a68ffb63dabbaeb57010270c435687))
* ctx options ref ([896c145](https://github.com/Tada5hi/action-docker-release/commit/896c14555d341596e35c735ec1366faac14145d1))
* extending github repository ([7e0c8fd](https://github.com/Tada5hi/action-docker-release/commit/7e0c8fda8dbd3f20241ad85d7b82d05157eb8395))
* git tree path normalization ([3479c51](https://github.com/Tada5hi/action-docker-release/commit/3479c516dcf3b9d6f58e856d909b6b1c77ac7b71))
* prevent to set a slash for empty string ([5d49278](https://github.com/Tada5hi/action-docker-release/commit/5d492780ac894206c07c96ba9bc6dac547871fe3))


### Features

* only check for changes if path or ignores option is set ([802d06d](https://github.com/Tada5hi/action-docker-release/commit/802d06dc0576b810689239495a4bbf73b82cb217))

# [1.2.0](https://github.com/Tada5hi/action-docker-release/compare/v1.1.2...v1.2.0) (2022-12-25)


### Features

* add ignore otpion for change detection ([f4c36eb](https://github.com/Tada5hi/action-docker-release/commit/f4c36eba052bbca6e0010f1c0533eec20a115ca2))

## [1.1.2](https://github.com/Tada5hi/action-docker-release/compare/v1.1.1...v1.1.2) (2022-12-25)


### Bug Fixes

* removing same image tag ([7806213](https://github.com/Tada5hi/action-docker-release/commit/78062132b55e5d1319b0f9fb7bc22d3c4604f01e))

## [1.1.1](https://github.com/Tada5hi/action-docker-release/compare/v1.1.0...v1.1.1) (2022-12-25)


### Bug Fixes

* enhance logging ([cc06215](https://github.com/Tada5hi/action-docker-release/commit/cc06215158388c19cc6dc097266210678ab29a37))

# [1.1.0](https://github.com/Tada5hi/action-docker-js/compare/v1.0.2...v1.1.0) (2022-12-25)


### Features

* use lerna.json as fallback + docker logout on finish ([2d080ba](https://github.com/Tada5hi/action-docker-js/commit/2d080baae952529ad7b328991a05a9e21fe5394f))

## [1.0.2](https://github.com/Tada5hi/action-docker-js/compare/v1.0.1...v1.0.2) (2022-12-25)


### Bug Fixes

* github url building ([dedfae1](https://github.com/Tada5hi/action-docker-js/commit/dedfae16d6ec4f730690a36f885118600b6a13e3))
* package check ([a5239cd](https://github.com/Tada5hi/action-docker-js/commit/a5239cdc016a9eeb3fa8ca208ad0bebc55016cdc))

## [1.0.1](https://github.com/Tada5hi/action-docker-js/compare/v1.0.0...v1.0.1) (2022-12-25)


### Bug Fixes

* removed dockerode library ([1e71cca](https://github.com/Tada5hi/action-docker-js/commit/1e71cca2b7eeb9cfddcc70fab1b0f6da1dc898d8))

# 1.0.0 (2022-12-23)


### Bug Fixes

* better check if package changed ([c565650](https://github.com/Tada5hi/action-docker-js/commit/c565650dd032f8efca7de72065797022b398a586))
