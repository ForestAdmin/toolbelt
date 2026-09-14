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
    default?: unknown | ((v: T) => unknown);
    oclif: { char?: string; description: string };
    prompter?: { question: string; description?: string };
  };
};

function optionToInquirer(name: string, option: CommandOptions[string]): unknown {
  const { os } = inject() as any; // eslint-disable-line @typescript-eslint/no-explicit-any

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

/**
 * Resolve the options that would have been prompted, from their declared defaults.
 *
 * Same selection rules as `getInteractiveOptions` (has a prompter, not already set,
 * not shadowed by an exclusive option, `when` satisfied) — it just answers with the
 * declared default instead of asking. Used by commands running unattended, where a
 * prompt would write to stdout and block on an answer nobody is there to give.
 */
export function getDefaultOptions<T>(
  options: CommandOptions,
  values: Record<string, unknown> = {},
): T {
  const resolved: Record<string, unknown> = {};

  Object.entries(options).forEach(([name, option]) => {
    if (
      !option.prompter || // Would not have been asked
      values[name] !== undefined || // Already set
      (option.exclusive ?? []).some(e => values[e] !== undefined) || // Shadowed
      option.default === undefined // Nothing to fall back on
    )
      return;

    // A default may depend on the options resolved before it (e.g. databasePort reads
    // the dialect), just as inquirer feeds previous answers to the next question.
    const answersSoFar: Record<string, unknown> = { ...values, ...resolved };
    if (option.when && !option.when(answersSoFar)) return;

    resolved[name] =
      typeof option.default === 'function'
        ? (option.default as (v: Record<string, unknown>) => unknown)(answersSoFar)
        : option.default;
  });

  return resolved as T;
}

/**
 * Get options that were passed in the command line.
 *
 * Missing ones are asked interactively, unless `interactive` is false — then their
 * declared defaults are used and nothing is ever written to stdout.
 */
export async function getCommandLineOptions<T>(
  instance: Command,
  { interactive = true }: { interactive?: boolean } = {},
): Promise<T> {
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

    // Validate
    const error = optionsFromCli[k] !== undefined && v.validate?.(optionsFromCli[k]);
    if (typeof error === 'string') throw new Error(`Invalid value for ${k}: ${error}`);
  });

  // Query missing options interactively, or fall back on their declared defaults
  const missingOptions = interactive
    ? await getInteractiveOptions<T>(options, optionsFromCli)
    : getDefaultOptions<T>(options, optionsFromCli);

  return { ...optionsFromCli, ...missingOptions };
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
