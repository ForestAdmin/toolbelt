<p align="center">
  <img src="https://github.com/ForestAdmin/toolbelt/blob/master/assets/logo.png?raw=true" alt="Toolbelt logo">
</p>

[![npm package](https://badge.fury.io/js/forest-cli.svg)](https://badge.fury.io/js/forest-cli)
[![Build Status](https://travis-ci.org/ForestAdmin/toolbelt.svg?branch=master)](https://travis-ci.org/ForestAdmin/toolbelt)
![Coverage](https://img.shields.io/badge/coverage-81%25%0A-critical)

The Lumberjacks' toolbelt is the Forest Admin CLI which makes easy to manage your back office application directly from the terminal.


### Install
    $ npm install -g forest-cli

### Commands

    $ forest [command]

#### General
- `user` display the current logged in user.
- `login` sign in to your Forest Admin account.
- `logout` sign out of your Forest Admin account.
- `help [cmd]` display help for [cmd].

#### Projects

Manage Forest Admin projects.

- `projects` list your projects.
- `projects:get` get the configuration of a project.

#### Environments

Manage Forest Admin environments.

- `environments` list your environments.
- `environments:get` get the configuration of an environment.
- `environments:create` create a new environment.
- `environments:delete` delete an environment.
- `environments:copy-layout` copy the layout from one environment to another.

### Schema

Manage Forest Admin schema.

- `schema:apply` apply the current schema of your repository to the specified environment (using your `.forestadmin-schema.json` file).

## Community

👇 Join our Slack community of +1000 developers

[![Slack Status](http://community.forestadmin.com/badge.svg)](https://community.forestadmin.com)
