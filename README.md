# Forest Admin CLI
<p align="center">
  <img src="https://github.com/ForestAdmin/toolbelt/blob/master/assets/logo.png?raw=true" alt="Toolbelt logo">
</p>

[![npm package](https://badge.fury.io/js/forest-cli.svg)](https://badge.fury.io/js/forest-cli)
[![Build Status](https://github.com/ForestAdmin/toolbelt/workflows/Build,%20Test%20and%20Deploy/badge.svg?branch=master)](https://github.com/ForestAdmin/toolbelt/actions)
[![Test Coverage](https://api.codeclimate.com/v1/badges/8c0c80478866e3399c92/test_coverage)](https://codeclimate.com/github/ForestAdmin/toolbelt/test_coverage)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

The Lumberjacks' toolbelt is the Forest Admin CLI which makes easy to manage your back office application directly from the terminal.

## Install

    $ npm install -g forest-cli

## Commands

    $ forest [command]

### General

- `user` display the current logged in user.
- `login` sign in to your Forest Admin account.
- `logout` sign out of your Forest Admin account.
- `help [cmd]` display help for [cmd].

### Projects

Manage Forest Admin projects.

- `projects` list your projects.
- `projects:create <appName>` generate a backend application with an ORM/ODM configured.
- `projects:get` get the configuration of a project.

### Environments

Manage Forest Admin environments.

- `environments` list your environments.
- `environments:get` get the configuration of an environment.
- `environments:create` create a new environment.
- `environments:delete` delete an environment.

Without the Development Workflow experience.
- `environments:copy-layout` copy the layout from one environment to another.

With the Development Workflow activated.
- `init` set up your development environment in your current folder.
- `branch` create a new branch or list your existing branches.
- `switch` switch to another branch in your local development environment.
- `push` push layout changes of your current branch to a remote environment.
- `deploy` deploy layout changes of an environment to the reference one.

### Schema

Manage Forest Admin schema.

- `schema:apply` apply the current schema of your repository to the specified environment (using your `.forestadmin-schema.json` file).
- `schema:update` refresh your schema by generating files that do not currently exist.


## Docker

### ENV variables

- `DATABASE_SCHEMA` the schema used by the database. (not for all commands)
- `DATABASE_URL` the connection string. (not fot all commands)
- `FOREST_ENV_SECRET` the env secret token used to recognize your environment you working on.
- `FOREST_URL` the URL of forestadmin-server.
- `SILENT` used to not log commands results. (optional)
- `TOKEN_PATH` path where store the session token. (need to be "/usr/src/app" to work with the docker image)

If you have an `.env` file in you current folder docker should take it to run commands. So you can define the missing ENV variable inside.
Otherwise you should pass all env variable you need in the `docker run` command, eg: `-e TOKEN_PATH="/usr/src/app"`.

### Commands
#### Using ForestAdmin in production
- `FOREST_URL`="https://api.forestadmin.com"
- `TOKEN_PATH`="/usr/src/app"

```bash
docker run --rm --init -it -v `pwd`:/usr/src/app forestadmin/toolbelt:latest [command]
```

#### Using ForestAdmin in development

- `FOREST_URL`="https://api.development.forestadmin.com"
- `TOKEN_PATH`="/usr/src/app"
- `NODE_TLS_REJECT_UNAUTHORIZED`=0

```bash
docker run --rm --init -it -v `pwd`:/usr/src/app --add-host=api.development.forestadmin.com:host-gateway forestadmin/toolbelt:latest [command]
```

## Community

👇 Join our Developers community for support and more

[![Discourse developers community](https://img.shields.io/discourse/posts?label=discourse&server=https%3A%2F%2Fcommunity.forestadmin.com)](https://community.forestadmin.com)
