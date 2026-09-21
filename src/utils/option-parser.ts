// Note that we're using inject() in the functions because we can't create an injectable class...
// Doing so prevents us from using optionsToArgs() and optionsToFlags() at startup

import type { Command } from '@oclif/core';

import { inject } from '@forestadmin/context';
import { Flags as oflags } from '@oclif/core';

/** Option which can be used both as  flag or prompt */
export type CommandOptions<T = Record<string, unknown>> = {
  [name: string]: {
    type?: 'string' | 'boolean';
    exclusive?: string[];
    choices?: Array<{ name: string; value: unknown }>;
    when?: (v: T) => boolean;
    validate?: (v: string) => boolean | string;
    /** Normalizes the answer before it is validated and stored (inquirer runs it first). */
    filter?: (v: string) => string;
    default?: unknown | ((v: T) => unknown);
    oclif: { char?: string; description: string };
    prompter?: { question: string; description?: string; secret?: boolean };
  };
};

function optionToInquirer(name: string, option: CommandOptions[string]): unknown {
  const { os } = inject() as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  // Use rawlist on windows because of https://github.com/SBoudrias/Inquirer.js/issues/303
  const listType = /^win/.test(os.platform()) ? 'rawlist' : 'list';
  // An option holding credentials must never be echoed: either its name says so, or it opts in
  // explicitly (a connection URL carries the password but is not named like one).
  const isSecret = option.prompter.secret || /(password|secret)/i.test(name);
  const inputType = isSecret ? 'password' : 'input';
  let type = option.choices ? listType : inputType;
  if (option.type === 'boolean') type = 'confirm';

  const result: Record<string, unknown> = { name, type, message: option.prompter.question };
  // Unlike a password, a connection URL is long and pasted: show its length so that a failed
  // paste is distinguishable from the blank answer that falls back to the field prompts.
  if (option.prompter.secret) result.mask = '*';
  if (option.prompter.description) result.description = option.prompter.description;
  if (option.choices) result.choices = option.choices;
  if (option.filter) result.filter = option.filter;
  if (option.validate) result.validate = option.validate;
  if (option.default !== undefined) result.default = option.default;
  if (option.when)
    // Make sure that the first question when() is evaluated after one tick (see hack below)
    result.when = async (args: Record<string, unknown>) => {
      await new Promise(resolve => setTimeout(resolve, 0));
      return option.when(args);
    };

  return result;
}

/** Query options interactively */
export async function getInteractiveOptions<T>(
  options: CommandOptions,
  values: Record<string, unknown> = {},
): Promise<T> {
  const { inquirer } = inject() as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const questions = Object.entries(options)
    .filter(
      ([name, option]) =>
        option.prompter && // Has a prompter
        values[name] === undefined && // Not already set
        (option.exclusive ?? []).every(e => values[e] === undefined), // Not exclusive with another option
    )
    .map(([name, option]) => optionToInquirer(name, option));

  const promise = inquirer.prompt(questions);

  // Passing answers we already have to inquirer is not supported in the legacy version we use
  // To work around this, we inject them in the inquirer ui object that is conveniently accessible
  // from the promise.
  // To fix this, we should upgrade to a newer version of inquirer.
  // Note that the if condition is always true, but not having it breaks the tests which are all
  // based on an inquirer.mock that returns a value (instead of a promise).
  if (promise?.ui?.answers) Object.assign(promise.ui.answers, values);

  return promise;
}

/** Get options that were passed in the command line */
export async function getCommandLineOptions<T>(instance: Command): Promise<T> {
  const { options } = instance.constructor as unknown as { options: CommandOptions };

  // Parse the command line arguments and flags.
  // @ts-expect-error: calling the argument parser from oclif is protected.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { args, flags } = (await instance.parse(instance.constructor)) as any;
  const optionsFromCli = { ...args, ...flags };

  Object.entries(options).forEach(([k, v]) => {
    // Replace choices with their value
    const choice = v.choices?.find(c => c.name === optionsFromCli[k]);
    if (choice) optionsFromCli[k] = choice.value;

    // Normalize the flag the way inquirer normalizes an answer (it runs `filter` first), so that
    // both paths agree on what the value is. A value the filter empties was never provided:
    // dropping it keeps the option out of the interactive skip logic below, instead of silently
    // suppressing the questions it is exclusive with (`-c '  '` used to skip every database
    // field prompt and leave the command with neither a connection URL nor a dialect).
    if (v.filter && typeof optionsFromCli[k] === 'string') {
      const filtered = v.filter(optionsFromCli[k]);
      if (filtered === '') delete optionsFromCli[k];
      else optionsFromCli[k] = filtered;
    }

    // Validate
    const error = optionsFromCli[k] !== undefined && v.validate?.(optionsFromCli[k]);
    if (typeof error === 'string') throw new Error(`Invalid value for ${k}: ${error}`);
  });

  // Query missing options interactively
  const optionsFromPrompt = await getInteractiveOptions<T>(options, optionsFromCli);

  return { ...optionsFromCli, ...optionsFromPrompt };
}

/** Convert generic options to oclif flags */
export function optionsToFlags(options: CommandOptions) {
  // Not using Object.fromEntries() for compatibility with node 10
  const result = {};

  Object.entries(options).forEach(([key, value]) => {
    const constructor = value.type === 'boolean' ? oflags.boolean : oflags.string;
    const flag = {
      char: value.oclif?.char as 'a',
      description: value.oclif.description,
      exclusive: value.exclusive,
      required: false,
      options: value.choices?.map(c => c.name),
    };

    result[key] = constructor(flag);
  });

  return result;
}
