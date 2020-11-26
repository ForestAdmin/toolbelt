## [1.7.4](https://github.com/ForestAdmin/toolbelt/compare/v1.7.3...v1.7.4) (2020-11-26)


### Bug Fixes

* **deploy-command:** allow project to be passed in as argument using --projectId or -p ([#122](https://github.com/ForestAdmin/toolbelt/issues/122)) ([2e36d3c](https://github.com/ForestAdmin/toolbelt/commit/2e36d3ce5955325556e1218f5257eafacb3df10d))

## [1.7.3](https://github.com/ForestAdmin/toolbelt/compare/v1.7.2...v1.7.3) (2020-11-20)


### Bug Fixes

* **push-command:** allow project to be passed in as argument using --projectId or -p ([#123](https://github.com/ForestAdmin/toolbelt/issues/123)) ([fd6250e](https://github.com/ForestAdmin/toolbelt/commit/fd6250e01b11226978e9ce97376c25d19d4018af))

## [1.7.2](https://github.com/ForestAdmin/toolbelt/compare/v1.7.1...v1.7.2) (2020-09-24)


### Bug Fixes

* change link to docs in the init command ([#112](https://github.com/ForestAdmin/toolbelt/issues/112)) ([35a114e](https://github.com/ForestAdmin/toolbelt/commit/35a114e240d4f6a4b722eaf4b76b2d2d4cdf9e0a))

## [1.7.1](https://github.com/ForestAdmin/toolbelt/compare/v1.7.0...v1.7.1) (2020-09-07)


### Bug Fixes

* **test:** isolate temporary files to reduce random test fails ([#107](https://github.com/ForestAdmin/toolbelt/issues/107)) ([e9717bc](https://github.com/ForestAdmin/toolbelt/commit/e9717bcf5908aeff23115266b33e85d55a63d9de))

# [1.7.0](https://github.com/ForestAdmin/toolbelt/compare/v1.6.3...v1.7.0) (2020-08-21)


### Features

* add includeLegacy parameter to project by env secret retrieval ([#106](https://github.com/ForestAdmin/toolbelt/issues/106)) ([d32c0ad](https://github.com/ForestAdmin/toolbelt/commit/d32c0ad9e009ed6e3cee314203b603b481aac450))

## [1.6.3](https://github.com/ForestAdmin/toolbelt/compare/v1.6.2...v1.6.3) (2020-08-17)


### Bug Fixes

* **commands:** add newline at end of generated `.env` file ([#104](https://github.com/ForestAdmin/toolbelt/issues/104)) ([8dc6ec7](https://github.com/ForestAdmin/toolbelt/commit/8dc6ec75a324b4e48e7e87986954472a7e5d3089))
* **commands:** remove Slack reference in error messages ([#105](https://github.com/ForestAdmin/toolbelt/issues/105)) ([d2b1d6c](https://github.com/ForestAdmin/toolbelt/commit/d2b1d6ca703c589c9c3df210f64ca0c19ef98878))

## [1.6.2](https://github.com/ForestAdmin/toolbelt/compare/v1.6.1...v1.6.2) (2020-08-17)


### Bug Fixes

* add missing `forest-environment-id` header to deploy command API call ([#103](https://github.com/ForestAdmin/toolbelt/issues/103)) ([902d0e6](https://github.com/ForestAdmin/toolbelt/commit/902d0e6e4e815aef17a4cb2ae0a0051dcfcd4af1))

## [1.6.1](https://github.com/ForestAdmin/toolbelt/compare/v1.6.0...v1.6.1) (2020-07-30)


### Bug Fixes

* **vulnerabilities:** bump 2 dependencies of dependencies ([#96](https://github.com/ForestAdmin/toolbelt/issues/96)) ([fb17fbe](https://github.com/ForestAdmin/toolbelt/commit/fb17fbe8afa9de9b6478343869e2b84bb2d559d8))

# [1.6.0](https://github.com/ForestAdmin/toolbelt/compare/v1.5.3...v1.6.0) (2020-06-24)


### Features

* **command:** add deploy command ([#93](https://github.com/ForestAdmin/toolbelt/issues/93)) ([a5fd0cf](https://github.com/ForestAdmin/toolbelt/commit/a5fd0cfe769fb95656176b1ad492f5424a9cc726))

## [1.5.3](https://github.com/ForestAdmin/toolbelt/compare/v1.5.2...v1.5.3) (2020-06-19)


### Bug Fixes

* **commands:** update misleading error message for push command ([#92](https://github.com/ForestAdmin/toolbelt/issues/92)) ([4c406c7](https://github.com/ForestAdmin/toolbelt/commit/4c406c72ee69dd7380af57055a2ed678cf1de8f3))

## [1.5.2](https://github.com/ForestAdmin/toolbelt/compare/v1.5.1...v1.5.2) (2020-06-02)


### Bug Fixes

* remove "Cannot read property 'dim' of undefined" message when command is not found ([#89](https://github.com/ForestAdmin/toolbelt/issues/89)) ([e9a85b6](https://github.com/ForestAdmin/toolbelt/commit/e9a85b6789de7504fddb3adcd95e13b7c3e628c0))

## [1.5.1](https://github.com/ForestAdmin/toolbelt/compare/v1.5.0...v1.5.1) (2020-06-01)


### Bug Fixes

* **commands:** make each commands run as expected ([0531c08](https://github.com/ForestAdmin/toolbelt/commit/0531c08c0fdc8d7f17b522fcd379d1577855c7da))

# [1.5.0](https://github.com/ForestAdmin/toolbelt/compare/v1.4.1...v1.5.0) (2020-06-01)


### Features

* **command:** add new push branch command ([#78](https://github.com/ForestAdmin/toolbelt/issues/78)) ([f255fba](https://github.com/ForestAdmin/toolbelt/commit/f255fba67bf8d4b13258d411b82edf5fff92b61e))

## [1.4.1](https://github.com/ForestAdmin/toolbelt/compare/v1.4.0...v1.4.1) (2020-05-28)


### Bug Fixes

* **branch:** fix switch command when environment has no current branch ([#88](https://github.com/ForestAdmin/toolbelt/issues/88)) ([d118b1f](https://github.com/ForestAdmin/toolbelt/commit/d118b1f7da99918b04a2b2b045025b912420aae9))
* homogenize all displayed error messages style ([#87](https://github.com/ForestAdmin/toolbelt/issues/87)) ([2f14aa4](https://github.com/ForestAdmin/toolbelt/commit/2f14aa4316ee244ce64276c40fa06c799e11dcea))

# [1.4.0](https://github.com/ForestAdmin/toolbelt/compare/v1.3.4...v1.4.0) (2020-05-27)


### Features

* add forest init command ([#58](https://github.com/ForestAdmin/toolbelt/issues/58)) ([872b130](https://github.com/ForestAdmin/toolbelt/commit/872b1307aadce1deda032d20115e3f3c11c6d0c3))

## [1.3.4](https://github.com/ForestAdmin/toolbelt/compare/v1.3.3...v1.3.4) (2020-05-26)


### Bug Fixes

* homogenize the format of the command descriptions ([#83](https://github.com/ForestAdmin/toolbelt/issues/83)) ([4a1aecb](https://github.com/ForestAdmin/toolbelt/commit/4a1aecb853807dd195141c1d975c530fd9cf9b8d))

## [1.3.3](https://github.com/ForestAdmin/toolbelt/compare/v1.3.2...v1.3.3) (2020-05-20)


### Bug Fixes

* **authentication:** fix login and logout messages ([#80](https://github.com/ForestAdmin/toolbelt/issues/80)) ([da42a02](https://github.com/ForestAdmin/toolbelt/commit/da42a025c6d3bd4f2d6deef93ec837741aa2ebcb))

## [1.3.2](https://github.com/ForestAdmin/toolbelt/compare/v1.3.1...v1.3.2) (2020-05-20)


### Bug Fixes

* **spinner:** avoid promise failures on paused spinner ([#75](https://github.com/ForestAdmin/toolbelt/issues/75)) ([bc11afe](https://github.com/ForestAdmin/toolbelt/commit/bc11afe28f9fc1e07d3121ae460a7bf5f4d427b0))

## [1.3.1](https://github.com/ForestAdmin/toolbelt/compare/v1.3.0...v1.3.1) (2020-05-19)


### Bug Fixes

* **spinner:** fix cli lock on spinner pause ([#73](https://github.com/ForestAdmin/toolbelt/issues/73)) ([d7bdad6](https://github.com/ForestAdmin/toolbelt/commit/d7bdad6a02d78ced5d33619fdc566de57054d366))

# [1.3.0](https://github.com/ForestAdmin/toolbelt/compare/v1.2.0...v1.3.0) (2020-05-18)


### Bug Fixes

* **spinner:** remove unneeded check on attachToPromise ([#71](https://github.com/ForestAdmin/toolbelt/issues/71)) ([75fa9e9](https://github.com/ForestAdmin/toolbelt/commit/75fa9e93e68faa7d3bdd26eb70c3543f342ed741))


### Features

* **branch:** add switch command ([#61](https://github.com/ForestAdmin/toolbelt/issues/61)) ([74f401a](https://github.com/ForestAdmin/toolbelt/commit/74f401a4a2d8173e070e36ffd1e972db32d40e83))
* add new spinner singleton instance and service for cli commands ([#68](https://github.com/ForestAdmin/toolbelt/issues/68)) ([2379db4](https://github.com/ForestAdmin/toolbelt/commit/2379db413476bd072128440ebd8b14f56de2a875))

## RELEASE 1.2.0 - 2020-05-13
### Added
- Technical - Add sonar lint.
- Technical - Make the CI lint the commit messages.
- Readme - Add the test coverage badge.
- Technical - Add unexpected error management in tests.
- Technical - Add an api error deserializer.
- Branch command - Add `--help` option.
- Branch command - Add branch creation.
- Branch command - Add branch list.
- Branch command - Add branch delete.
- Branch command - Allow users to specify a custom target project.

### Changed
- Technical - Untrack IDE `.idea` folder.
- Technical - Reduce the complexity of `Prompter.isRequested` method.
- Technical - Introduce conventional commits.
- Technical - Adapt release manager to conventional commits.
- Tests - Add test for `forest environments:create` command.
- Technical - Use Jest instead of Mocha for the test base.
- Technical - Rename the class of the environments update command.
- Technical - Remove CI configuration warnings.
- Technical - Remove useless CI configuration.
- Readme - Update the community badge.
- Dependencies - Get rid of useless dev dependencies (`globby`, `moment`, `nyc`, `semver`).

### Fixed
- Authentication - Exit any process if the authentication fails.
- Tests - Fix authentication problems during tests.
- Security - Patch `acorn` dependency vulnerabilities.
- Dependencies - Get rid of useless `git-hooks` dependency.

## RELEASE 1.1.0 - 2020-03-20
### Added
- Environments - Add environments:update command.
- Authentication - Add Google authentication.
- Technical - Add tests on google authentication.
- Technical - Add lint pre-commit-hook.
- Tests - Add test for `forest environments` command.

### Changed
- Technical - Clean temporary tests files.
- Logs - Remove worrisome emojis (such as fire and skulls) from error messages.
- Login command - Perform login before any authenticated operation if not already logged.
- Commands - Ease the selection of project.
- Technical - Remove caching of authToken and api endpoint.
- Logout command - Display an explicit message when users having a lumber session try to logout.

## RELEASE 1.0.5 - 2020-03-10
### Fixed
- Apimap Apply - Fix apply on recent apimap.

## RELEASE 1.0.4 - 2020-03-10
### Added
- Versioning - Configure the `warn-if-update-available` plugin that warns when a new version is available.
- Prompt - Add the `@oclif/plugin-not-found` plugin which print "did you mean ...?" to correct the user input.

### Changed
- Readme - Add a community section.
- Readme - Remove the Licence section as it is already accessible in the Github page header.
- Technical - Upgrade ESLint rules.
- Technical - Replace `package-lock.json` by `yarn.lock`.
- Technical - Upgrade the CI Node version.
- Technical - Add the linter in the CI.
- Authentication - Try to authenticate using `.lumberrc`
- Technical - Ignore .iml files

### Fixed
- License - Add missing license file.

## RELEASE 1.0.3 - 2019-07-31
### Added
- Updates - Warn users if an update of the Toolbelt is available.

### Changed
- Technical - Rename environment variable SERVER_HOST to FOREST_URL.
- Security - Patch `lodash` dependency vulnerabilities.

### Fixed
- Build - Fix build script.

## RELEASE 1.0.2 - 2019-03-28
### Changed
- Login command - Add env variables to avoid prompt in the login command.

## RELEASE 1.0.1 - 2019-02-14
### Changed
- Readme - Improve the wording.
- Help - Improve a command description.

## RELEASE 1.0.0 - 2019-02-14
### Added
- Projects - Authenticated users can list their projects.
- Environments - Authenticated users can list/create/delete their environments.
- Environments - Authenticated users can copy the layout from one environment to another.
- Environments - Authenticated users can manually apply the schema of an environment if it uses the liana version 3+ (with a `.forestadmin-schema.json`).
