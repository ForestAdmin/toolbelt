const path = require('path');
const { flags } = require('@oclif/command');
const makeDefaultPlan = require('../../context/init');
const SchemaSerializer = require('../../serializers/schema');
const SchemaSender = require('../../services/schema-sender');
const JobStateChecker = require('../../services/job-state-checker');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');

class ApplyCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan || makeDefaultPlan());
    const {
      assertPresent,
      env,
      fs,
      joi,
    } = this.context;
    assertPresent({ env, fs, joi });
    this.env = env;
    this.fs = fs;
    this.joi = joi;
  }

  async runIfAuthenticated() {
    const oclifExit = this.exit.bind(this);
    const { flags: parsedFlags } = this.parse(ApplyCommand);
    const serializedSchema = this.readSchema();
    const secret = this.getEnvironmentSecret(parsedFlags);
    const authenticationToken = this.authenticator.getAuthToken();

    this.logger.log('Sending "./.forestadmin-schema.json"...');
    const jobId = await new SchemaSender(
      serializedSchema,
      secret,
      authenticationToken,
      oclifExit,
    ).perform();

    if (jobId) {
      await new JobStateChecker('Processing schema', oclifExit).check(jobId);
      this.logger.log('Schema successfully sent to forest.');
    } else {
      this.logger.log('The schema is the same as before, nothing changed.');
    }

    return null;
  }

  readSchema() {
    this.logger.log('Reading "./.forestadmin-schema.json"...');
    const filename = path.resolve('./.forestadmin-schema.json');

    if (!this.fs.existsSync(filename)) {
      this.logger.error('Cannot find the file ".forestadmin-schema.json" in this directory. Please be sure to run this command inside your project directory.');
      this.exit(1);
    }

    let schema;
    try {
      schema = JSON.parse(this.fs.readFileSync(filename, 'utf8'));
    } catch (error) {
      this.logger.error(`Invalid json: ${error.message}`);
      this.exit(1);
    }

    if (!schema) {
      this.logger.error('The ".forestadmin-schema.json" file is empty');
      this.exit(1);
    }

    const { error } = this.joi.validate(schema, this.joi.object().keys({
      collections: this.joi.array().items(this.joi.object()).required(),
      meta: this.joi.object().keys({
        liana: this.joi.string().required(),
        orm_version: this.joi.string().required(),
        database_type: this.joi.string().required(),
        liana_version: this.joi.string().required(),
        framework_version: this.joi.string().allow(null),
      }).unknown().required(),
    }), { convert: false });

    if (error) {
      let message = 'Cannot properly read the ".forestadmin-schema.json" file:\n - ';
      message += error.details.map((detail) => detail.message).join('\n - ');
      this.logger.error(message);
      this.exit(20);
    }

    return new SchemaSerializer().perform(schema.collections, schema.meta);
  }

  getEnvironmentSecret(parsedFlags) {
    let secret;

    if (parsedFlags.secret) {
      secret = parsedFlags.secret;
    } else if (this.env.FOREST_ENV_SECRET) {
      this.logger.log('Using the forest environment secret found in the environment variable "FOREST_ENV_SECRET"');
      secret = this.env.FOREST_ENV_SECRET;
    } else {
      this.logger.error('Cannot find your forest environment secret in the environment variable "FOREST_ENV_SECRET".\nPlease set the "FOREST_ENV_SECRET" variable or pass the secret in parameter using --secret.');
      this.exit(2);
    }

    return secret;
  }
}

ApplyCommand.description = 'Apply the current schema of your repository to the specified environment (using your ".forestadmin-schema.json" file).';

ApplyCommand.flags = {
  secret: flags.string({
    char: 's',
    description: 'Environment secret of the project (FOREST_ENV_SECRET).',
    required: false,
  }),
};

module.exports = ApplyCommand;
