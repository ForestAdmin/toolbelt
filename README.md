<p align="center">
  <img src="https://github.com/ForestAdmin/toolbelt/blob/master/assets/logo.png?raw=true" alt="Toolbelt logo">
</p>

[![Build Status](https://travis-ci.org/ForestAdmin/toolbelt.svg?branch=master)](https://travis-ci.org/ForestAdmin/toolbelt)

The Lumberjacks' toolbelt is the Forest CLI which makes easy to manage your back office application directly from the terminal.


### Install
    $ npm install -g forest-toolbelt

### Commands

    $ forest [command]

#### General
- `user`          show your current logged user.
- `login`         sign in to your Forest account.
- `logout`        sign out of your Forest account.
- `help [cmd]`    display help for [cmd].

#### Projects

Manage Forest projects.

- `projects:list` list existing projects.
- `projects:get`  get the configuration of a project.

#### Environments

Manage Forest environments.

- `environments:list`         manage Forest environments.
- `environments:get`          get the configuration of an environment.
- `environments:create`       create a new environment.
- `environments:delete`       delete an environment.
- `environments:copy-layout`  copy the layout from one environment to another.

### Schema

Manage Forest schema.

- `schema:apply`              apply your latest schema to your Forest layouts using your ".forestadmin-schema.json" file.

## License
[GPL](https://github.com/ForestAdmin/toolbelt/blob/master/LICENSE)
