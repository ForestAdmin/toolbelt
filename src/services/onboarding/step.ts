/**
 * Set on the `forest` commands `forest start` runs. Each is then one step of a longer setup, so it
 * must not announce the setup as done: install, build and boot are still ahead.
 */
export const START_STEP_ENV = 'FOREST_START_STEP';

export const isStartStep = (): boolean => Boolean(process.env[START_STEP_ENV]);
