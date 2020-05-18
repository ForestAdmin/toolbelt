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
