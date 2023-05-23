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
    description: string;
    exclusive?: string[];
    choices?: string[];
    when?: (v: T) => boolean;
    validate?: (v: string) => boolean | string;
    default?: (v: T) => unknown;
    oclif?: { char?: string; name?: string; order?: number };
    prompter?: { order?: number };
  };
};

/** Convert Option to inquiry prompt */
function optionToPrompt(
  name: string,
  option: CommandOptions[string],
  values: Record<string, unknown>,
): unknown {
  // Use rawlist on windows because of https://github.com/SBoudrias/Inquirer.js/issues/303
  const { os } = inject() as any;
  const listType = /^win/.test(os.platform()) ? 'rawlist' : 'list';
  const inputType = name.match(/(password|secret)/i) ? 'password' : 'input';

  return {
    name,
    type: option.choices ? listType : inputType,
    choices: option.choices,
    message: option.description,
    validate: option.validate,
    default: option.default?.(values),
  };
}

/** Get options from the cli command and validate them */
function getCliOptions(instance: Command, options: CommandOptions): Record<string, unknown> {
  // Parse the command line arguments and flags.
  // @ts-expect-error: calling the argument parser from oclif is protected.
  const { args, flags } = instance.parse(instance.constructor) as any;
  const values = { ...args, ...flags };

  Object.entries(options).forEach(([k, v]) => {
    // Rename aliases
    if (v.oclif.name) {
      values[k] = values[v.oclif.name];
      delete values[v.oclif.name];
    }

    // Validate
    if (values[k] !== undefined && v.validate) {
      const validation = v.validate(values[k]);
      if (typeof validation === 'string') throw new Error(`Invalid value for ${k}: ${validation}`);
    }
  });

  return values;
}

/** Query missing options using inquiry */
async function queryMissing(
  options: CommandOptions,
  values: Record<string, unknown>,
): Promise<void> {
  const { inquirer } = inject() as any;
  const optionsList = Object.entries(options);

  // Missing data is requested interactively.
  for (let i = 0; i < optionsList.length; i += 1) {
    const [key, option] = optionsList[i];
    const shouldPrompt =
      values[key] === undefined && // Already provided
      !option.exclusive?.some(e => values[e] !== undefined) && // Exclusive option provided
      (!option.when || option.when(values)); // Condition met

    if (shouldPrompt) {
      const prompt = [optionToPrompt(key, option, values)];
      const answers = await inquirer.prompt(prompt);

      Object.assign(values, answers);
    }
  }
}

/** Get command configuration from both CLI arguments, flags and user prompts */
export async function getCommandOptions<T>(instance: Command): Promise<T> {
  const { options } = instance.constructor as unknown as { options: CommandOptions };

  const values = getCliOptions(instance, options);
  await queryMissing(options, values);
  return values as T;
}

/** Convert generic options to oclif flags */
export function optionsToFlags(options: CommandOptions): oflags.Input<unknown> {
  const entries = Object.entries(options).map(([key, value]) => [
    value.oclif.name || key,
    oflags.string({
      char: value.oclif.char as 'a',
      description: value.description,
      exclusive: value.exclusive,
      required: false,
    }),
  ]);

  return Object.fromEntries(entries);
}
