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
    choices?: Array<{ name: string; value: unknown }>;
    when?: (v: T) => boolean;
    validate?: (v: string) => boolean | string;
    default?: unknown | ((v: T) => unknown);
    oclif: { char?: string; description: string };
    prompter?: { question: string; description?: string };
  };
};

/** Query options interactively */
export async function getInteractiveOptions<T>(
  options: CommandOptions,
  values: Record<string, unknown> = {},
): Promise<T> {
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
      if (option.prompter.description) result.description = option.prompter.description;
      if (option.choices) result.choices = option.choices;
      if (option.validate) result.validate = option.validate;
      if (option.default !== undefined) result.default = option.default;
      if (option.when) result.when = option.when;

      return result;
    });

  return inquirer.prompt(questions, values);
}

/** Get options that were passed in the command line */
export async function getCommandLineOptions<T>(instance: Command): Promise<T> {
  const { options } = instance.constructor as unknown as { options: CommandOptions };

  // Parse the command line arguments and flags.
  // @ts-expect-error: calling the argument parser from oclif is protected.
  const { args, flags } = instance.parse(instance.constructor) as any;
  const optionsFromCli = { ...args, ...flags };

  // Replace choices with their value
  Object.entries(options).forEach(([k, v]) => {
    if (optionsFromCli[k] !== undefined && v.choices) {
      const choice = v.choices.find(c => c.name === optionsFromCli[k]);
      if (choice) optionsFromCli[k] = choice.value;
    }
  });

  // Validate
  Object.entries(options).forEach(([k, v]) => {
    if (optionsFromCli[k] !== undefined && v.validate) {
      const validation = v.validate(optionsFromCli[k]);
      if (typeof validation === 'string') throw new Error(`Invalid value for ${k}: ${validation}`);
    }
  });

  // Query missing options interactively
  const optionsFromPrompt = await getInteractiveOptions<T>(options, optionsFromCli);

  return { ...optionsFromCli, ...optionsFromPrompt };
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
      options: value.choices?.map(c => c.name),
    };

    return [key, constructor(flag)];
  });

  return Object.fromEntries(entries);
}
