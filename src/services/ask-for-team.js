const Context = require('@forestadmin/context');

const TeamManager = require('./team-manager');

/**
 * Prompt the user to pick a team of the current project. Mirrors
 * `ask-for-environment`: lists via the existing TeamManager and returns the
 * chosen team name (resolved to an id by the caller).
 * @param {{ projectId: number | string }} config
 * @param {string} message
 * @returns {Promise<string>} the chosen team name
 */
module.exports = async function askForTeam(config, message) {
  const { assertPresent, inquirer } = Context.inject();
  assertPresent({ inquirer });

  const teams = await new TeamManager(config).listForProject();

  if (!teams.length) throw new Error('No team available on this project.');

  const response = await inquirer.prompt([
    {
      name: 'team',
      message,
      type: 'list',
      choices: teams.map(({ name }) => name),
    },
  ]);

  return response.team;
};
