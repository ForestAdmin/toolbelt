import type { Hook } from '@oclif/core';

import Context from '@forestadmin/context';

import contextPlan from '../../context/logger-plan';

const hook: Hook<'init'> = async function (options) {
  const context: any = Context.execute(contextPlan);
  const { assertPresent, logger, chalk } = context;
  assertPresent({ logger, chalk });

  const NODE_VERSION_MINIMUM = 14;

  try {
    const nodeVersion = Number(process.version.split('.')[0].split('v')[1]);
    if (nodeVersion < NODE_VERSION_MINIMUM) {
      logger.log(
        chalk.red(
          `The Forest Admin toolbelt is not compatible with your current Node.js version (v${nodeVersion} detected). Please use Node.js v${NODE_VERSION_MINIMUM}+.`,
        ),
      );
      process.exit(0);
    }
  } catch (error) {
    // NOTICE: Fails silently and considers that Node.js version is greater than 14.
  }
};

export default hook;
