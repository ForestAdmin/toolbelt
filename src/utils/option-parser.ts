/**
 * This file contains a new implementation of the option parser.
 *
 * The idea is to have a single source of truth for the options, and then use it to:
 * - parse the command line arguments and flags
 * - prompt the user for missing options
 */

// Note that we're using inject() in the functions because we can't create an injectable class...
// Doing so prevents us from using optionsToArgs() and optionsToFlags() at startup

/* eslint-disable @typescript-eslint/no-explicit-any,no-await-in-loop,no-continue */

import type { Command } from '@oclif/command';

import { inject } from '@forestadmin/context';
import { flags as oflags } from '@oclif/command';

/** Option which can be used both as argument, flag or prompt */
export type CommandOptions<T = Record<string, unknown>> = {
  [name: string]: {
    type?: 'string' | 'boolean';
    exclusive?: string[];
    choices?: string[];
    when?: (v: T) => boolean;
    validate?: (v: string) => boolean | string;
    default?: unknown | ((v: T) => unknown);
    oclif: { char?: string; description: string };
    prompter?: { question?: string };
  };
};

/** Query options interactively */
export async function getInteractiveOptions(
  options: CommandOptions,
  values: Record<string, unknown> = {},
): Promise<void> {
  const { inquirer, os } = inject() as any;

  const questions = Object.entries(options)
    .filter(
      ([name, option]) =>
        option.prompter && // Has a prompter
        values[name] === undefined && // Not already set
        (option.exclusive ?? []).every(e => values[e] === undefined), // Not exclusive with another option
    )
    .map(([name, option]) => {
      // Use rawlist on windows because of https://github.com/SBoudrias/Inquirer.js/issues/303
      const listType = /^win/.test(os.platform()) ? 'rawlist' : 'list';
      const inputType = name.match(/(password|secret)/i) ? 'password' : 'input';
      let type = option.choices ? listType : inputType;
      if (option.type === 'boolean') type = 'confirm';

      const result: Record<string, unknown> = { name, type, message: option.prompter.question };
      if (option.choices) result.choices = option.choices;
      if (option.validate) result.validate = option.validate;
      if (option.default !== undefined) result.default = option.default;
      if (option.when) result.when = option.when;

      return result;
    });

  const result = await inquirer.prompt(questions, values);
  Object.assign(values, result);
}

/** Get options that were passed in the command line */
export async function getCommandLineOptions<T>(instance: Command): Promise<T> {
  const { options } = instance.constructor as unknown as { options: CommandOptions };

  // Parse the command line arguments and flags.
  // @ts-expect-error: calling the argument parser from oclif is protected.
  const { args, flags } = instance.parse(instance.constructor) as any;
  const values = { ...args, ...flags };

  // Validate
  Object.entries(options).forEach(([k, v]) => {
    if (values[k] !== undefined && v.validate) {
      const validation = v.validate(values[k]);
      if (typeof validation === 'string') throw new Error(`Invalid value for ${k}: ${validation}`);
    }
  });

  await getInteractiveOptions(options, values);
  return values as T;
}

/** Convert generic options to oclif flags */
export function optionsToFlags(options: CommandOptions): oflags.Input<unknown> {
  const entries = Object.entries(options).map(([key, value]) => {
    const constructor = value.type === 'boolean' ? oflags.boolean : oflags.string;
    const flag = {
      char: value.oclif?.char as 'a',
      description: value.oclif.description,
      exclusive: value.exclusive,
      required: false,
    };

    return [key, constructor(flag)];
  });

  return Object.fromEntries(entries);
}
