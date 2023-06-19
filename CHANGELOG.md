# [4.0.0-beta.3](https://github.com/ForestAdmin/toolbelt/compare/v4.0.0-beta.2...v4.0.0-beta.3) (2023-06-14)


### Bug Fixes

* **project-create:** do not crash when SQL databases use self-signed certificates ([#591](https://github.com/ForestAdmin/toolbelt/issues/591)) ([36e8674](https://github.com/ForestAdmin/toolbelt/commit/36e867437ec04da9e0af566a8ff770e1f51256fa))

# [4.0.0-beta.2](https://github.com/ForestAdmin/toolbelt/compare/v4.0.0-beta.1...v4.0.0-beta.2) (2023-06-08)


### Bug Fixes

* **project-creation:** prompt for database schema when only --databaseConnectionURL flag is given ([#602](https://github.com/ForestAdmin/toolbelt/issues/602)) ([ddec281](https://github.com/ForestAdmin/toolbelt/commit/ddec281b82d1d638bb1059af651bddaded5dba16))

## [3.4.3](https://github.com/ForestAdmin/toolbelt/compare/v3.4.2...v3.4.3) (2023-06-08)


### Bug Fixes

* **project-creation:** prompt for database schema when only --databaseConnectionURL flag is given ([#602](https://github.com/ForestAdmin/toolbelt/issues/602)) ([ddec281](https://github.com/ForestAdmin/toolbelt/commit/ddec281b82d1d638bb1059af651bddaded5dba16))

# [4.0.0-beta.1](https://github.com/ForestAdmin/toolbelt/compare/v3.4.2...v4.0.0-beta.1) (2023-05-31)


### Features

* **node:** end the support of Node.js versions 10, 11, 12, 13 ([#592](https://github.com/ForestAdmin/toolbelt/issues/592)) ([9c17132](https://github.com/ForestAdmin/toolbelt/commit/9c171329cb038f98448249b780e97da4859b7a0d))


### BREAKING CHANGES

* **node:** users will have to upgrade to Node.js version 14+ to ensure a full compatibility


## [3.4.2](https://github.com/ForestAdmin/toolbelt/compare/v3.4.1...v3.4.2) (2023-05-30)

## [3.4.1](https://github.com/ForestAdmin/toolbelt/compare/v3.4.0...v3.4.1) (2023-05-29)

# [3.4.0](https://github.com/ForestAdmin/toolbelt/compare/v3.3.0...v3.4.0) (2023-04-24)


### Features

* **agent-nodejs:** unify javascript and typescript generated code and .env ([#589](https://github.com/ForestAdmin/toolbelt/issues/589)) ([2001308](https://github.com/ForestAdmin/toolbelt/commit/200130884ca47d58a81a528484c848f5fa05a091))

# [3.3.0](https://github.com/ForestAdmin/toolbelt/compare/v3.2.4...v3.3.0) (2023-04-17)


### Features

* **typescript:** users can now generate agent-nodejs projects in typescript ([#571](https://github.com/ForestAdmin/toolbelt/issues/571)) ([58972d7](https://github.com/ForestAdmin/toolbelt/commit/58972d7f5cb98b068dde626c25c14e36208d385f))

## [3.2.4](https://github.com/ForestAdmin/toolbelt/compare/v3.2.3...v3.2.4) (2023-04-11)


### Bug Fixes

* **agent-nodejs:** properly pass the dialect options ([#582](https://github.com/ForestAdmin/toolbelt/issues/582)) ([759c39f](https://github.com/ForestAdmin/toolbelt/commit/759c39f51ca799c74920611618c5177126f7764d))

## [3.2.3](https://github.com/ForestAdmin/toolbelt/compare/v3.2.2...v3.2.3) (2023-03-31)


### Bug Fixes

* **agent-nodejs:** remove deprecated connection options on mongoose dumper ([#578](https://github.com/ForestAdmin/toolbelt/issues/578)) ([41c365c](https://github.com/ForestAdmin/toolbelt/commit/41c365ca73a03b4cbb2229f7bff1c04bc3e38bf2))

## [3.2.2](https://github.com/ForestAdmin/toolbelt/compare/v3.2.1...v3.2.2) (2023-03-30)


### Bug Fixes

* **mongoose-models:** don't use quote on model attributes that do not have special characters ([#577](https://github.com/ForestAdmin/toolbelt/issues/577)) ([1b1a3fc](https://github.com/ForestAdmin/toolbelt/commit/1b1a3fce48ef315665c3427a32ab78dae7594782))

## [3.2.1](https://github.com/ForestAdmin/toolbelt/compare/v3.2.0...v3.2.1) (2023-03-28)


### Bug Fixes

* **security:** patch xmldom dependency vulnerability ([#479](https://github.com/ForestAdmin/toolbelt/issues/479)) ([06c2909](https://github.com/ForestAdmin/toolbelt/commit/06c290909f2bcb813c377e1bde48048a03d66642))

# [3.2.0](https://github.com/ForestAdmin/toolbelt/compare/v3.1.11...v3.2.0) (2023-03-27)


### Features

* **create-command:** add commands to generate agent-nodejs projects ([#532](https://github.com/ForestAdmin/toolbelt/issues/532)) ([c791e87](https://github.com/ForestAdmin/toolbelt/commit/c791e87044579fe2a190305401b8fd151f3fdcff))

## [3.1.11](https://github.com/ForestAdmin/toolbelt/compare/v3.1.10...v3.1.11) (2023-03-15)


### Bug Fixes

* **schema:update:** properly retrieve the export path of the models when using multiple databases ([#555](https://github.com/ForestAdmin/toolbelt/issues/555)) ([0e676b9](https://github.com/ForestAdmin/toolbelt/commit/0e676b98a532d890e3ec1f0a925c743801177264))

## [3.1.10](https://github.com/ForestAdmin/toolbelt/compare/v3.1.9...v3.1.10) (2023-03-14)

## [3.1.9](https://github.com/ForestAdmin/toolbelt/compare/v3.1.8...v3.1.9) (2023-03-13)


### Bug Fixes

* **node10:** change build target to correctly support node10 ([#549](https://github.com/ForestAdmin/toolbelt/issues/549)) ([5fd2a6c](https://github.com/ForestAdmin/toolbelt/commit/5fd2a6c5f2b39e10c62693304a2822033b109285))

## [3.1.8](https://github.com/ForestAdmin/toolbelt/compare/v3.1.7...v3.1.8) (2023-03-13)

## [3.1.7](https://github.com/ForestAdmin/toolbelt/compare/v3.1.6...v3.1.7) (2023-03-13)


### Bug Fixes

* **update:** add back support of outputDirectory option ([#550](https://github.com/ForestAdmin/toolbelt/issues/550)) ([d691100](https://github.com/ForestAdmin/toolbelt/commit/d691100626c75eef7d708913a7f5400d976897e2))

## [3.1.6](https://github.com/ForestAdmin/toolbelt/compare/v3.1.5...v3.1.6) (2023-03-13)


### Features

* run diff command when push or deploy fails ([#529](https://github.com/ForestAdmin/toolbelt/issues/529)) ([40a236f](https://github.com/ForestAdmin/toolbelt/commit/40a236fdd9c2cb399e794c1a0423f9d24efdb0c6))

## [3.1.5](https://github.com/ForestAdmin/toolbelt/compare/v3.1.4...v3.1.5) (2023-03-09)

## [3.1.4](https://github.com/ForestAdmin/toolbelt/compare/v3.1.3...v3.1.4) (2023-03-08)


### Bug Fixes

* **docker:** correctly build docker image to prevent execution error ([#541](https://github.com/ForestAdmin/toolbelt/issues/541)) ([39be1bd](https://github.com/ForestAdmin/toolbelt/commit/39be1bd21565c255f46bef2e8de5f75d4823cea2))

## [3.1.3](https://github.com/ForestAdmin/toolbelt/compare/v3.1.2...v3.1.3) (2023-03-08)

## [3.1.2](https://github.com/ForestAdmin/toolbelt/compare/v3.1.1...v3.1.2) (2023-03-01)


### Bug Fixes

* **mongo:** don't use spinner when analyzing the database ([#535](https://github.com/ForestAdmin/toolbelt/issues/535)) ([db29809](https://github.com/ForestAdmin/toolbelt/commit/db29809121ccba46f77fb3b43972d40f1abc8d18))

## [3.1.1](https://github.com/ForestAdmin/toolbelt/compare/v3.1.0...v3.1.1) (2023-02-28)

# [3.1.0](https://github.com/ForestAdmin/toolbelt/compare/v3.0.12...v3.1.0) (2023-02-13)


### Features

* **schema-diff:** compare two environments api map ([#476](https://github.com/ForestAdmin/toolbelt/issues/476)) ([170da5d](https://github.com/ForestAdmin/toolbelt/commit/170da5da0f9fefe31e0d1f954885c5e4b011bce7))

## [3.0.12](https://github.com/ForestAdmin/toolbelt/compare/v3.0.11...v3.0.12) (2023-02-09)

## [3.0.12-beta.2](https://github.com/ForestAdmin/toolbelt/compare/v3.0.12-beta.1...v3.0.12-beta.2) (2023-02-08)

## [3.0.12-beta.1](https://github.com/ForestAdmin/toolbelt/compare/v3.0.11...v3.0.12-beta.1) (2023-02-08)

## [3.0.11](https://github.com/ForestAdmin/toolbelt/compare/v3.0.10...v3.0.11) (2023-02-03)


### Bug Fixes

* **security:** patch http-cache-semantics dependencies vulnerabilities ([#500](https://github.com/ForestAdmin/toolbelt/issues/500)) ([8dd4998](https://github.com/ForestAdmin/toolbelt/commit/8dd49986bab9b391cb080f49a65d93ce15b82044))

## [3.0.10](https://github.com/ForestAdmin/toolbelt/compare/v3.0.9...v3.0.10) (2023-01-24)


### Bug Fixes

* **security:** patch cookiejar dependency vulnerabilities ([#490](https://github.com/ForestAdmin/toolbelt/issues/490)) ([5020460](https://github.com/ForestAdmin/toolbelt/commit/5020460aaa69828ff5ffa4670382b126615c3e9c))

## [3.0.9](https://github.com/ForestAdmin/toolbelt/compare/v3.0.8...v3.0.9) (2023-01-19)


### Bug Fixes

* **security:** patch got dependency vulnerability ([#488](https://github.com/ForestAdmin/toolbelt/issues/488)) ([635df16](https://github.com/ForestAdmin/toolbelt/commit/635df16ca6cc2fbd4b913b70e9d096effbcb9903))

## [3.0.8](https://github.com/ForestAdmin/toolbelt/compare/v3.0.7...v3.0.8) (2023-01-19)


### Bug Fixes

* **security:** patch qs dependency vulnerabilities ([#489](https://github.com/ForestAdmin/toolbelt/issues/489)) ([9384928](https://github.com/ForestAdmin/toolbelt/commit/9384928a3c1beccaa0af9dad6542465cc4b5a443))

## [3.0.7](https://github.com/ForestAdmin/toolbelt/compare/v3.0.6...v3.0.7) (2023-01-19)


### Bug Fixes

* **security:** patch jose dependency vulnerability ([#487](https://github.com/ForestAdmin/toolbelt/issues/487)) ([4c658c3](https://github.com/ForestAdmin/toolbelt/commit/4c658c330bdfa52de90c384ff3c0a9232cd2b069))

## [3.0.6](https://github.com/ForestAdmin/toolbelt/compare/v3.0.5...v3.0.6) (2022-11-30)


### Bug Fixes

* handle case when apiEndPoint is null during the onboarding ([#463](https://github.com/ForestAdmin/toolbelt/issues/463)) ([e24c175](https://github.com/ForestAdmin/toolbelt/commit/e24c175acca94a4f2ea904770b9c09c4dfb991fe))

## [3.0.5](https://github.com/ForestAdmin/toolbelt/compare/v3.0.4...v3.0.5) (2022-11-28)


### Bug Fixes

* clarify some errors message ([#455](https://github.com/ForestAdmin/toolbelt/issues/455)) ([226d6dc](https://github.com/ForestAdmin/toolbelt/commit/226d6dc2c5889499da2708247ca093c26adfe77d))

## [3.0.4](https://github.com/ForestAdmin/toolbelt/compare/v3.0.3...v3.0.4) (2022-11-02)


### Bug Fixes

* **templates:** update doc links ([#357](https://github.com/ForestAdmin/toolbelt/issues/357)) ([3c022a9](https://github.com/ForestAdmin/toolbelt/commit/3c022a99913f9fd3b57d289da69fdf142cbf8849))

## [3.0.3](https://github.com/ForestAdmin/toolbelt/compare/v3.0.2...v3.0.3) (2022-10-26)


### Bug Fixes

* display correct error message when the origin environment has be… ([#440](https://github.com/ForestAdmin/toolbelt/issues/440)) ([f97e5fb](https://github.com/ForestAdmin/toolbelt/commit/f97e5fb00a05217ba2dcd403cf14e7bbc0184b44))

## [3.0.2](https://github.com/ForestAdmin/toolbelt/compare/v3.0.1...v3.0.2) (2022-10-25)


### Performance Improvements

* fix performance issue on pg greater that 12 when updating models ([#444](https://github.com/ForestAdmin/toolbelt/issues/444)) ([f451140](https://github.com/ForestAdmin/toolbelt/commit/f4511409a8688a346c8f78a1de13f4c3eccf0c17))

## [3.0.1](https://github.com/ForestAdmin/toolbelt/compare/v3.0.0...v3.0.1) (2022-10-10)


### Bug Fixes

* **ci:** mark beta as a prerelease delivery channel ([#421](https://github.com/ForestAdmin/toolbelt/issues/421)) ([f33464f](https://github.com/ForestAdmin/toolbelt/commit/f33464f84673a78fefafd5ee167513a6fb182a2e))

## [3.0.1-beta.1](https://github.com/ForestAdmin/toolbelt/compare/v3.0.0...v3.0.1-beta.1) (2022-09-06)


### Bug Fixes

* **ci:** mark beta as a prerelease delivery channel ([#421](https://github.com/ForestAdmin/toolbelt/issues/421)) ([f33464f](https://github.com/ForestAdmin/toolbelt/commit/f33464f84673a78fefafd5ee167513a6fb182a2e))

# [3.0.0](https://github.com/ForestAdmin/toolbelt/compare/v2.7.2...v3.0.0) (2022-09-06)


### Features

* users can now change their branch origin ([#414](https://github.com/ForestAdmin/toolbelt/issues/414)) ([fab4ef5](https://github.com/ForestAdmin/toolbelt/commit/fab4ef5a1efb89943401258d2334b67c624dfc49))


### BREAKING CHANGES

* `forest branch`, `forest push`, `forest deploy` usage is now based on `FOREST_ENV_SECRET`

## [2.7.2](https://github.com/ForestAdmin/toolbelt/compare/v2.7.1...v2.7.2) (2022-07-06)


### Bug Fixes

* **auth:** display a better error message when the provided token is empty ([#402](https://github.com/ForestAdmin/toolbelt/issues/402)) ([0648bb3](https://github.com/ForestAdmin/toolbelt/commit/0648bb3af247bf0b8c1eefb894a3cc26948e003d))

## [2.7.1](https://github.com/ForestAdmin/toolbelt/compare/v2.7.0...v2.7.1) (2022-07-04)


### Bug Fixes

* **init:** correctly generate database url when needed ([#384](https://github.com/ForestAdmin/toolbelt/issues/384)) ([4ae33e2](https://github.com/ForestAdmin/toolbelt/commit/4ae33e2d99231cd7380ba93de74233b1a5046076))
* **security:** patch semantic-release dependencies vulnerabilities ([#391](https://github.com/ForestAdmin/toolbelt/issues/391)) ([889f503](https://github.com/ForestAdmin/toolbelt/commit/889f50378abb0c383aebfedd093946e274ae6e32))
* **security:** patch semver-regex dependency vulnerability ([#390](https://github.com/ForestAdmin/toolbelt/issues/390)) ([8a05858](https://github.com/ForestAdmin/toolbelt/commit/8a05858553625c9c2ca4103278dd773757371a1a))

# [2.7.0](https://github.com/ForestAdmin/toolbelt/compare/v2.6.11...v2.7.0) (2022-05-31)


### Features

* add mariadb support ([#385](https://github.com/ForestAdmin/toolbelt/issues/385)) ([6eb5650](https://github.com/ForestAdmin/toolbelt/commit/6eb56507b3d3ccebf4bcb7aaa733de986f1dd58c))

## [2.6.11](https://github.com/ForestAdmin/toolbelt/compare/v2.6.10...v2.6.11) (2022-05-10)


### Bug Fixes

* **schema:** fix incorrect dateonly model type detection ([#377](https://github.com/ForestAdmin/toolbelt/issues/377)) ([441df27](https://github.com/ForestAdmin/toolbelt/commit/441df2718edc35388b5a7aa87194583acb57f8af))

## [2.6.10](https://github.com/ForestAdmin/toolbelt/compare/v2.6.9...v2.6.10) (2022-05-04)


### Bug Fixes

* upgrade generated project using express-jwt to 6.1.2 ([#375](https://github.com/ForestAdmin/toolbelt/issues/375)) ([7dd58d6](https://github.com/ForestAdmin/toolbelt/commit/7dd58d69eca0744679238664b5123e04bfba08a0))

## [2.6.9](https://github.com/ForestAdmin/toolbelt/compare/v2.6.8...v2.6.9) (2022-05-04)


### Bug Fixes

* **dockerfile:** upgrade generated dockerfile to use node 14 alpine as base ([#374](https://github.com/ForestAdmin/toolbelt/issues/374)) ([878233c](https://github.com/ForestAdmin/toolbelt/commit/878233c0df78b92bebdc2d0db4a8a5b3b7bbf45c))

## [2.6.8](https://github.com/ForestAdmin/toolbelt/compare/v2.6.7...v2.6.8) (2022-04-27)


### Bug Fixes

* **cors:** add access control allow private network handling ([#372](https://github.com/ForestAdmin/toolbelt/issues/372)) ([9c324fe](https://github.com/ForestAdmin/toolbelt/commit/9c324fef49187882599ba17915556b55361f6771))

## [2.6.7](https://github.com/ForestAdmin/toolbelt/compare/v2.6.6...v2.6.7) (2022-04-19)


### Bug Fixes

* **security:** patch ansi-regex dependency vulnerabilities ([8bb7fb5](https://github.com/ForestAdmin/toolbelt/commit/8bb7fb5d0e402e9430862f6106305efd92782d04))
* **security:** patch ansi-regex dependency vulnerabilities ([f0a9693](https://github.com/ForestAdmin/toolbelt/commit/f0a969351e39e3bd10479112244b7b80b19b7e32))
* **security:** patch async dependency vulnerabilities ([78e36e3](https://github.com/ForestAdmin/toolbelt/commit/78e36e3e04069e761539333e62147d0817977034))
* **security:** patch follow-redirects dependency vulnerabilities ([1c03034](https://github.com/ForestAdmin/toolbelt/commit/1c03034d887a882b6b12881677bcda1c78841be8))
* **security:** patch jsprim dependency vulnerabilities ([14a59d8](https://github.com/ForestAdmin/toolbelt/commit/14a59d836c6aa5a6d34e5218babb245d8a5aeecc))
* **security:** patch moment dependency vulnerabilities ([239c91a](https://github.com/ForestAdmin/toolbelt/commit/239c91aa1acda928664a3855b4528d736cacd1a3))
* **security:** patch node-fetch dependency vulnerability ([#349](https://github.com/ForestAdmin/toolbelt/issues/349)) ([8c5661c](https://github.com/ForestAdmin/toolbelt/commit/8c5661c923fb57210c94e5083caf8b7e2d513b75))

## [2.6.6](https://github.com/ForestAdmin/toolbelt/compare/v2.6.5...v2.6.6) (2022-04-19)


### Bug Fixes

* **security:** patch minimist dependency vulnerabilities ([#362](https://github.com/ForestAdmin/toolbelt/issues/362)) ([b675a31](https://github.com/ForestAdmin/toolbelt/commit/b675a310bb4e021f11dbf48cf0b7387e700ebc48))

## [2.6.5](https://github.com/ForestAdmin/toolbelt/compare/v2.6.4...v2.6.5) (2022-04-15)


### Bug Fixes

* **deps:** remove vulnerability on generated projects ([#369](https://github.com/ForestAdmin/toolbelt/issues/369)) ([d00aaca](https://github.com/ForestAdmin/toolbelt/commit/d00aacab619e3f26e71d1631d3f009fc9bc9f4e9))

## [2.6.4](https://github.com/ForestAdmin/toolbelt/compare/v2.6.3...v2.6.4) (2022-04-06)


### Bug Fixes

* **datatypes:** MONEY is not automatically generated anymore on Postgresql and MsSql ([#360](https://github.com/ForestAdmin/toolbelt/issues/360)) ([ac7ab3e](https://github.com/ForestAdmin/toolbelt/commit/ac7ab3e4da6d077f00dc9c5d0e81c22f5c539c68))

## [2.6.3](https://github.com/ForestAdmin/toolbelt/compare/v2.6.2...v2.6.3) (2022-03-28)

## [2.6.2](https://github.com/ForestAdmin/toolbelt/compare/v2.6.1...v2.6.2) (2022-03-22)


### Bug Fixes

* upgraded Mongoose version in order to resolve vulnerabilities ([#356](https://github.com/ForestAdmin/toolbelt/issues/356)) ([a1cbee1](https://github.com/ForestAdmin/toolbelt/commit/a1cbee17038d55728cf88e842ee320346ee46f47))

## [2.6.1](https://github.com/ForestAdmin/toolbelt/compare/v2.6.0...v2.6.1) (2022-03-15)


### Bug Fixes

* **templates:** add link to performance doc in count route ([#355](https://github.com/ForestAdmin/toolbelt/issues/355)) ([f7ebd92](https://github.com/ForestAdmin/toolbelt/commit/f7ebd928121757a3c5f7ffa92327288b789a71ff))

# [2.6.0](https://github.com/ForestAdmin/toolbelt/compare/v2.5.5...v2.6.0) (2022-02-21)


### Features

* send better events during project generation ([#348](https://github.com/ForestAdmin/toolbelt/issues/348)) ([60a2800](https://github.com/ForestAdmin/toolbelt/commit/60a2800a5e4e9029d50fe9f7cbe28f53f915b5c1))

## [2.5.5](https://github.com/ForestAdmin/toolbelt/compare/v2.5.4...v2.5.5) (2022-01-03)


### Bug Fixes

* **mongodb:** fix typos on the "analysis" word ([#324](https://github.com/ForestAdmin/toolbelt/issues/324)) ([47670a9](https://github.com/ForestAdmin/toolbelt/commit/47670a9d5f12e3574e62d6368d17a420014af6c1))

## [2.5.4](https://github.com/ForestAdmin/toolbelt/compare/v2.5.3...v2.5.4) (2021-12-31)


### Bug Fixes

* **logger:** allow logger to display object ([#321](https://github.com/ForestAdmin/toolbelt/issues/321)) ([d81d5f1](https://github.com/ForestAdmin/toolbelt/commit/d81d5f17cab5980ee4009c6b8fe56a1ad06a743f))

## [2.5.3](https://github.com/ForestAdmin/toolbelt/compare/v2.5.2...v2.5.3) (2021-12-31)


### Bug Fixes

* **mongodb:** force to display progress bar by default ([#322](https://github.com/ForestAdmin/toolbelt/issues/322)) ([c318970](https://github.com/ForestAdmin/toolbelt/commit/c3189707f294615aeecb2a3617519af289486806))

## [2.5.2](https://github.com/ForestAdmin/toolbelt/compare/v2.5.1...v2.5.2) (2021-12-30)


### Bug Fixes

* **mongodb:** fix the onboarding cli when mongodb does't support js ([#311](https://github.com/ForestAdmin/toolbelt/issues/311)) ([ee97db2](https://github.com/ForestAdmin/toolbelt/commit/ee97db2146a0e62f883f0aec9026d21567d809f0))

## [2.5.1](https://github.com/ForestAdmin/toolbelt/compare/v2.5.0...v2.5.1) (2021-12-10)


### Bug Fixes

* error message when the user wants to create a branch on a remote branch ([#285](https://github.com/ForestAdmin/toolbelt/issues/285)) ([2cbde60](https://github.com/ForestAdmin/toolbelt/commit/2cbde60e62f0172ea306e729d374a737db428cb6))

# [2.5.0](https://github.com/ForestAdmin/toolbelt/compare/v2.4.1...v2.5.0) (2021-11-15)


### Features

* **reset:** allow users to reset layout changes on a remote environment ([#284](https://github.com/ForestAdmin/toolbelt/issues/284)) ([1c2ce0e](https://github.com/ForestAdmin/toolbelt/commit/1c2ce0e8aaccb05ca6747a40e0a24ca5aa759172))

## [2.4.1](https://github.com/ForestAdmin/toolbelt/compare/v2.4.0...v2.4.1) (2021-10-28)


### Bug Fixes

* change the method to generate files to be compatible with sequelize@6 ([#267](https://github.com/ForestAdmin/toolbelt/issues/267)) ([4600ffe](https://github.com/ForestAdmin/toolbelt/commit/4600ffe94d8cb910ef29df5d6eade9bdfb99d8e8))

# [2.4.0](https://github.com/ForestAdmin/toolbelt/compare/v2.3.6...v2.4.0) (2021-10-26)


### Bug Fixes

* display projects when connected with sso ([#265](https://github.com/ForestAdmin/toolbelt/issues/265)) ([83ec508](https://github.com/ForestAdmin/toolbelt/commit/83ec5082ac94b5610b5f1da712b200b521539d1d))


### Features

* show if the user is connected via sso or not ([#266](https://github.com/ForestAdmin/toolbelt/issues/266)) ([5a5a865](https://github.com/ForestAdmin/toolbelt/commit/5a5a865d2e5480130526beb14bcbb7055818ec84))

## [2.3.6](https://github.com/ForestAdmin/toolbelt/compare/v2.3.5...v2.3.6) (2021-10-22)


### Bug Fixes

* **docker:** avoid using NODE_PATH in docker ([#260](https://github.com/ForestAdmin/toolbelt/issues/260)) ([fe5e365](https://github.com/ForestAdmin/toolbelt/commit/fe5e365a6aa921de1cf2f459d72419b80aba4c39))

## [2.3.5](https://github.com/ForestAdmin/toolbelt/compare/v2.3.4...v2.3.5) (2021-10-14)


### Bug Fixes

* **docker:** pass schema directory via process environment ([#229](https://github.com/ForestAdmin/toolbelt/issues/229)) ([0005856](https://github.com/ForestAdmin/toolbelt/commit/0005856f8df0f49c7f1ffcbc1e3e04e89ea144c0))

## [2.3.4](https://github.com/ForestAdmin/toolbelt/compare/v2.3.3...v2.3.4) (2021-09-22)


### Bug Fixes

* **security:** patch hosted-git-info dependency vulnerabilities ([#228](https://github.com/ForestAdmin/toolbelt/issues/228)) ([aee5744](https://github.com/ForestAdmin/toolbelt/commit/aee5744539f71bf118c86bd44826b7236519ed69))

## [2.3.3](https://github.com/ForestAdmin/toolbelt/compare/v2.3.2...v2.3.3) (2021-09-22)


### Bug Fixes

* **security:** patch glob-parent dependency vulnerability  ([#185](https://github.com/ForestAdmin/toolbelt/issues/185)) ([ec0e407](https://github.com/ForestAdmin/toolbelt/commit/ec0e4077a1b6936f0974b2750390d11872eae1d9))
* **security:** patch hosted-git-info dependency vulnerability ([#187](https://github.com/ForestAdmin/toolbelt/issues/187)) ([6ba6afb](https://github.com/ForestAdmin/toolbelt/commit/6ba6afbaf7d31a647cdb4a8b1c5336406e656eb4))
* **security:** patch normalize-url dependency vulnerability ([#181](https://github.com/ForestAdmin/toolbelt/issues/181)) ([dbdc185](https://github.com/ForestAdmin/toolbelt/commit/dbdc1853d07663b983f594816f75a613f92c11fa))

## [2.3.2](https://github.com/ForestAdmin/toolbelt/compare/v2.3.1...v2.3.2) (2021-09-22)


### Bug Fixes

* **security:** patch dependencies of dependencies vulnerabilities ([#227](https://github.com/ForestAdmin/toolbelt/issues/227)) ([b0875f5](https://github.com/ForestAdmin/toolbelt/commit/b0875f5ec82e2347557d2d76c2fe5f24803472c9))

## [2.3.1](https://github.com/ForestAdmin/toolbelt/compare/v2.3.0...v2.3.1) (2021-09-22)


### Bug Fixes

* **security:** patch jose dependency vulnerability ([#161](https://github.com/ForestAdmin/toolbelt/issues/161)) ([f224f04](https://github.com/ForestAdmin/toolbelt/commit/f224f047386b825a5b2c2d9382e33b8c772217f3))
* **security:** patch path-parse dependency vulnerabilities ([#214](https://github.com/ForestAdmin/toolbelt/issues/214)) ([9532d3f](https://github.com/ForestAdmin/toolbelt/commit/9532d3f443fbc26010f5de236d9ed51ca1568b44))
* **security:** patch semantic-release vulnerabilities ([#225](https://github.com/ForestAdmin/toolbelt/issues/225)) ([abd1aff](https://github.com/ForestAdmin/toolbelt/commit/abd1affdaea34b4020af5265b931ede6557cfb18))
* **security:** patch tmpl dependency vulnerabilities ([#224](https://github.com/ForestAdmin/toolbelt/issues/224)) ([3a6a4ae](https://github.com/ForestAdmin/toolbelt/commit/3a6a4aec2f9925f7056fb38148cc782f2971e6bc))

# [2.3.0](https://github.com/ForestAdmin/toolbelt/compare/v2.2.8...v2.3.0) (2021-09-02)


### Features

* display the auth secret when creating an environment ([#219](https://github.com/ForestAdmin/toolbelt/issues/219)) ([6320f5d](https://github.com/ForestAdmin/toolbelt/commit/6320f5d64780c06c1232fe98e4ec80be788537e5))

## [2.2.8](https://github.com/ForestAdmin/toolbelt/compare/v2.2.7...v2.2.8) (2021-08-25)


### Bug Fixes

* **dumper:** ignore stats model name when generating/updating project to avoid route conflicts ([#216](https://github.com/ForestAdmin/toolbelt/issues/216)) ([649f802](https://github.com/ForestAdmin/toolbelt/commit/649f802cb7740ab1896fe689b1871330e5f5d7d8))

## [2.2.7](https://github.com/ForestAdmin/toolbelt/compare/v2.2.6...v2.2.7) (2021-08-16)


### Bug Fixes

* correct HTML markup in generated view/index.html ([#215](https://github.com/ForestAdmin/toolbelt/issues/215)) ([5968d15](https://github.com/ForestAdmin/toolbelt/commit/5968d15d5ad6d9245e8b32dd69d0e713a8d79207))

## [2.2.6](https://github.com/ForestAdmin/toolbelt/compare/v2.2.5...v2.2.6) (2021-08-04)


### Bug Fixes

* automatically add `fieldsToFlatten` property for mongoose projects to the generated files ([#212](https://github.com/ForestAdmin/toolbelt/issues/212)) ([08b5661](https://github.com/ForestAdmin/toolbelt/commit/08b566108887c11b155423ba409cc6d9d06270f4))

## [2.2.5](https://github.com/ForestAdmin/toolbelt/compare/v2.2.4...v2.2.5) (2021-08-03)


### Bug Fixes

* avoid details route conflicting with count when overriding details route ([#211](https://github.com/ForestAdmin/toolbelt/issues/211)) ([0060bfd](https://github.com/ForestAdmin/toolbelt/commit/0060bfd7f03a09490c75ea3e1d9fa9c538129b89))

## [2.2.4](https://github.com/ForestAdmin/toolbelt/compare/v2.2.3...v2.2.4) (2021-07-26)


### Bug Fixes

* transmit databaseSchema in command projects:create ([#210](https://github.com/ForestAdmin/toolbelt/issues/210)) ([c6fd2e3](https://github.com/ForestAdmin/toolbelt/commit/c6fd2e3c3f1596f0984caad85ba5b57618e0d5a8))

## [2.2.3](https://github.com/ForestAdmin/toolbelt/compare/v2.2.2...v2.2.3) (2021-07-23)


### Bug Fixes

* handle properly mongo connection close ([#209](https://github.com/ForestAdmin/toolbelt/issues/209)) ([4a6da5d](https://github.com/ForestAdmin/toolbelt/commit/4a6da5d9233367be73ab2096f6cfef52525c93c8))

## [2.2.2](https://github.com/ForestAdmin/toolbelt/compare/v2.2.1...v2.2.2) (2021-07-20)

## [2.2.1](https://github.com/ForestAdmin/toolbelt/compare/v2.2.0...v2.2.1) (2021-07-16)

# [2.2.0](https://github.com/ForestAdmin/toolbelt/compare/v2.1.2...v2.2.0) (2021-07-15)


### Bug Fixes

* logout also logout from forest.d folder ([#202](https://github.com/ForestAdmin/toolbelt/issues/202)) ([4adb531](https://github.com/ForestAdmin/toolbelt/commit/4adb5317c3e03e5b7603505189c9b4c572247dab))
* save token in forest.d folder ([#201](https://github.com/ForestAdmin/toolbelt/issues/201)) ([d560d45](https://github.com/ForestAdmin/toolbelt/commit/d560d456992ce5f089fbe2e9c52531414c188f64))


### Features

* get token from forest folder ([#199](https://github.com/ForestAdmin/toolbelt/issues/199)) ([e6ac1e6](https://github.com/ForestAdmin/toolbelt/commit/e6ac1e60ee283e0d82ef8df47a6d8a2e791d3f58))
* merge lumber commands into toolbelt ([#198](https://github.com/ForestAdmin/toolbelt/issues/198)) ([e647b6b](https://github.com/ForestAdmin/toolbelt/commit/e647b6b64ff64530035658f05743d34ed9bf2584))

# [2.2.0-beta.4](https://github.com/ForestAdmin/toolbelt/compare/v2.2.0-beta.3...v2.2.0-beta.4) (2021-07-13)

# [2.2.0-beta.3](https://github.com/ForestAdmin/toolbelt/compare/v2.2.0-beta.2...v2.2.0-beta.3) (2021-07-12)


### Bug Fixes

* logout also logout from forest.d folder ([#202](https://github.com/ForestAdmin/toolbelt/issues/202)) ([4adb531](https://github.com/ForestAdmin/toolbelt/commit/4adb5317c3e03e5b7603505189c9b4c572247dab))

# [2.2.0-beta.2](https://github.com/ForestAdmin/toolbelt/compare/v2.2.0-beta.1...v2.2.0-beta.2) (2021-07-12)


### Bug Fixes

* save token in forest.d folder ([#201](https://github.com/ForestAdmin/toolbelt/issues/201)) ([d560d45](https://github.com/ForestAdmin/toolbelt/commit/d560d456992ce5f089fbe2e9c52531414c188f64))

# [2.2.0-beta.1](https://github.com/ForestAdmin/toolbelt/compare/v2.1.2...v2.2.0-beta.1) (2021-07-09)


### Features

* get token from forest folder ([#199](https://github.com/ForestAdmin/toolbelt/issues/199)) ([e6ac1e6](https://github.com/ForestAdmin/toolbelt/commit/e6ac1e60ee283e0d82ef8df47a6d8a2e791d3f58))
* merge lumber commands into toolbelt ([#198](https://github.com/ForestAdmin/toolbelt/issues/198)) ([e647b6b](https://github.com/ForestAdmin/toolbelt/commit/e647b6b64ff64530035658f05743d34ed9bf2584))

## [2.1.2](https://github.com/ForestAdmin/toolbelt/compare/v2.1.1...v2.1.2) (2021-06-17)


### Bug Fixes

* validate that project id is an integer instead of a string ([#194](https://github.com/ForestAdmin/toolbelt/issues/194)) ([dd1eac3](https://github.com/ForestAdmin/toolbelt/commit/dd1eac335a86dc6c4f2b38bff98192bfb579b938))

## [2.1.1](https://github.com/ForestAdmin/toolbelt/compare/v2.1.0...v2.1.1) (2021-06-10)


### Bug Fixes

* accept new meta key format for forestadmin schema ([#182](https://github.com/ForestAdmin/toolbelt/issues/182)) ([360b1a7](https://github.com/ForestAdmin/toolbelt/commit/360b1a7e908706b2b8cf1bb43918e4a199aeade3))

# [2.1.0](https://github.com/ForestAdmin/toolbelt/compare/v2.0.8...v2.1.0) (2021-05-26)


### Features

* **switch-command:** add branch:switch alias ([#170](https://github.com/ForestAdmin/toolbelt/issues/170)) ([a4ab481](https://github.com/ForestAdmin/toolbelt/commit/a4ab48143ad70a949126d43b9a3e550dc4482b88))

## [2.0.8](https://github.com/ForestAdmin/toolbelt/compare/v2.0.7...v2.0.8) (2021-05-25)

## [2.0.7](https://github.com/ForestAdmin/toolbelt/compare/v2.0.6...v2.0.7) (2021-05-25)


### Bug Fixes

* update cli-table dependency ([28638b2](https://github.com/ForestAdmin/toolbelt/commit/28638b26bf846109ed179fd0d6b122249983dc61))

## [2.0.6](https://github.com/ForestAdmin/toolbelt/compare/v2.0.5...v2.0.6) (2021-04-29)


### Bug Fixes

* add missing keys isReadOnly for actions fields, isPrimaryKey and foreignAndPrimaryKey for fields ([5c031cc](https://github.com/ForestAdmin/toolbelt/commit/5c031cc79b018bf84c1a3b36e734f5edfbdee447))

## [2.0.5](https://github.com/ForestAdmin/toolbelt/compare/v2.0.4...v2.0.5) (2021-04-09)


### Bug Fixes

* **dwo:** allow to deploy on remote non production reference environment ([d68c52a](https://github.com/ForestAdmin/toolbelt/commit/d68c52affb2169df23236b14a37db66f8054827d))

## [2.0.4](https://github.com/ForestAdmin/toolbelt/compare/v2.0.3...v2.0.4) (2021-04-06)


### Bug Fixes

* **security:** patch marked dependency vulnerabilities ([#157](https://github.com/ForestAdmin/toolbelt/issues/157)) ([f99829b](https://github.com/ForestAdmin/toolbelt/commit/f99829bc124ef81ae025d78c16c993500db25766))

## [2.0.3](https://github.com/ForestAdmin/toolbelt/compare/v2.0.2...v2.0.3) (2021-04-06)


### Bug Fixes

* **security:** patch ini dependency vulnerabilities ([#156](https://github.com/ForestAdmin/toolbelt/issues/156)) ([6e2f979](https://github.com/ForestAdmin/toolbelt/commit/6e2f979f7b1495d199ee26c3e21628a9b26ef6e8))

## [2.0.2](https://github.com/ForestAdmin/toolbelt/compare/v2.0.1...v2.0.2) (2021-04-06)


### Bug Fixes

* **security:** patch y18n dependency vulnerabilities ([#155](https://github.com/ForestAdmin/toolbelt/issues/155)) ([2786cd1](https://github.com/ForestAdmin/toolbelt/commit/2786cd178a7c0c9b64ad0366f3749e24ccd29257))

## [2.0.1](https://github.com/ForestAdmin/toolbelt/compare/v2.0.0...v2.0.1) (2021-03-19)


### Bug Fixes

* **logout:** logout command now works as expected ([#153](https://github.com/ForestAdmin/toolbelt/issues/153)) ([c289d7f](https://github.com/ForestAdmin/toolbelt/commit/c289d7f9f1d26ca625b050957a390b51a04591df))

# [2.0.0](https://github.com/ForestAdmin/toolbelt/compare/v1.7.6...v2.0.0) (2021-02-23)


### Bug Fixes

* error when preparing the release ([#137](https://github.com/ForestAdmin/toolbelt/issues/137)) ([79eb5b8](https://github.com/ForestAdmin/toolbelt/commit/79eb5b828f00b86faf6691400bd00642344b59e4))


### Features

* login without entering a password, and use application tokens ([#136](https://github.com/ForestAdmin/toolbelt/issues/136)) ([6bc64e8](https://github.com/ForestAdmin/toolbelt/commit/6bc64e86e88409fef08644d9c1822dd36e10ae69))


### BREAKING CHANGES

* the default login method now require to validate a temporary code on Forest Admin

# [2.0.0-beta.3](https://github.com/ForestAdmin/toolbelt/compare/v2.0.0-beta.2...v2.0.0-beta.3) (2021-02-22)


### Bug Fixes

* serialize hooks information with schema:apply ([#139](https://github.com/ForestAdmin/toolbelt/issues/139)) ([2e0589a](https://github.com/ForestAdmin/toolbelt/commit/2e0589a10ea95d1d2a5d2647b60d41d5ba418320))

## [1.7.6](https://github.com/ForestAdmin/toolbelt/compare/v1.7.5...v1.7.6) (2020-12-24)


### Bug Fixes

* serialize hooks information with schema:apply ([#139](https://github.com/ForestAdmin/toolbelt/issues/139)) ([2e0589a](https://github.com/ForestAdmin/toolbelt/commit/2e0589a10ea95d1d2a5d2647b60d41d5ba418320))

# [2.0.0-beta.2](https://github.com/ForestAdmin/toolbelt/compare/v2.0.0-beta.1...v2.0.0-beta.2) (2020-12-23)


### Bug Fixes

* error when preparing the release ([#137](https://github.com/ForestAdmin/toolbelt/issues/137)) ([79eb5b8](https://github.com/ForestAdmin/toolbelt/commit/79eb5b828f00b86faf6691400bd00642344b59e4))

# [2.0.0-beta.1](https://github.com/ForestAdmin/toolbelt/compare/v1.7.5...v2.0.0-beta.1) (2020-12-18)


### Features

* login without entering a password, and use application tokens ([#136](https://github.com/ForestAdmin/toolbelt/issues/136)) ([6bc64e8](https://github.com/ForestAdmin/toolbelt/commit/6bc64e86e88409fef08644d9c1822dd36e10ae69))


### BREAKING CHANGES

* the default login method now require to validate a temporary code on Forest Admin

## [1.7.5](https://github.com/ForestAdmin/toolbelt/compare/v1.7.4...v1.7.5) (2020-12-03)


### Bug Fixes

* prevent installation error due to premature evaluation caused by a dependency ([99799e3](https://github.com/ForestAdmin/toolbelt/commit/99799e3010d385a6d9212115d438536fc486b2be))

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
