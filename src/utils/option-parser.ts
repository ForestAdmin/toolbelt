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
    description: string;
    exclusive?: string[];
    choices?: string[];
    when?: (v: T) => boolean;
    validate?: (v: string) => boolean | string;
    default?: (v: T) => unknown;
    oclif?: { char?: string };
    prompter?: { skip?: boolean };
  };
};

/** Query missing options using inquiry */
async function queryMissing(
  options: CommandOptions,
  values: Record<string, unknown>,
): Promise<void> {
  const { inquirer, os } = inject() as any;

  const questions = Object.entries(options)
    .filter(([, opt]) => !opt?.prompter?.skip)
    .map(([name, option]) => {
      // Use rawlist on windows because of https://github.com/SBoudrias/Inquirer.js/issues/303
      const listType = /^win/.test(os.platform()) ? 'rawlist' : 'list';
      const inputType = name.match(/(password|secret)/i) ? 'password' : 'input';
      let type = option.choices ? listType : inputType;
      if (option.type === 'boolean') type = 'confirm';

      return {
        name,
        type,
        choices: option.choices,
        message: option.description,
        validate: option.validate,
        default: answers => option.default?.(answers),
        when: answers => {
          if (answers[name] !== undefined) return false;
          if (option.exclusive?.some(e => values[e] !== undefined)) return false;
          if (option.when && !option.when(answers)) return false;

          return true;
        },
      };
    });

  const result = await inquirer.prompt(questions, values);
  Object.assign(values, result);
}

/** Get command configuration from both CLI arguments, flags and user prompts */
export async function getCommandOptions<T>(instance: Command): Promise<T> {
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

  await queryMissing(options, values);
  return values as T;
}

/** Convert generic options to oclif flags */
export function optionsToFlags(options: CommandOptions): oflags.Input<unknown> {
  const entries = Object.entries(options).map(([key, value]) => [
    key,
    (value.type === 'boolean' ? oflags.boolean : oflags.string)({
      char: value.oclif?.char as 'a',
      description: value.description,
      exclusive: value.exclusive,
      required: false,
    }),
  ]);

  return Object.fromEntries(entries);
}
