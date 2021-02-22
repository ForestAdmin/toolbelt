<p align="center">
  <img src="https://github.com/ForestAdmin/toolbelt/blob/master/assets/logo.png?raw=true" alt="Toolbelt logo">
</p>

[![npm package](https://badge.fury.io/js/forest-cli.svg)](https://badge.fury.io/js/forest-cli)
[![Build Status](https://github.com/ForestAdmin/toolbelt/workflows/Build,%20Test%20and%20Deploy/badge.svg?branch=master)](https://github.com/ForestAdmin/toolbelt/actions)
[![Test Coverage](https://api.codeclimate.com/v1/badges/8c0c80478866e3399c92/test_coverage)](https://codeclimate.com/github/ForestAdmin/toolbelt/test_coverage)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

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

👇 Join our Developers community for support and more

[![Discourse developers community](https://img.shields.io/discourse/posts?label=discourse&server=https%3A%2F%2Fcommunity.forestadmin.com)](https://community.forestadmin.com)
