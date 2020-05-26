const { Command, flags } = require('@oclif/command');
const fs = require('fs');
const path = require('path');
const Joi = require('joi');
const SchemaSerializer = require('../../serializers/schema');
const SchemaSender = require('../../services/schema-sender');
const JobStateChecker = require('../../services/job-state-checker');

class ApplyCommand extends Command {
  async run() {
    const logError = this.error.bind(this);
    const { flags: parsedFlags } = this.parse(ApplyCommand);
    const serializedSchema = this.readSchema();
    const secret = this.getEnvironmentSecret(parsedFlags);

    this.log('Sending "./.forestadmin-schema.json"...');
    const jobId = await new SchemaSender(serializedSchema, secret, logError).perform();

    if (jobId) {
      await new JobStateChecker('Processing schema', logError).check(jobId);
      this.log('Schema successfully sent to forest.');
    } else {
      this.log('The schema is the same as before, nothing changed.');
    }

    return null;
  }

  readSchema() {
    this.log('Reading "./.forestadmin-schema.json"...');
    const filename = path.resolve('./.forestadmin-schema.json');

    if (!fs.existsSync(filename)) {
      this.error('Cannot find the file ".forestadmin-schema.json" in this directory. Please be sure to run this command inside your project directory.', { exit: 1 });
    }

    let schema;
    try {
      schema = JSON.parse(fs.readFileSync(filename, 'utf8'));
    } catch (error) {
      this.error(`Invalid json: ${error.message}`, { exit: 1 });
    }

    if (!schema) {
      this.error('The ".forestadmin-schema.json" file is empty', { exit: 1 });
    }

    const { error } = Joi.validate(schema, Joi.object().keys({
      collections: Joi.array().items(Joi.object()).required(),
      meta: Joi.object().keys({
        liana: Joi.string().required(),
        orm_version: Joi.string().required(),
        database_type: Joi.string().required(),
        liana_version: Joi.string().required(),
        framework_version: Joi.string().allow(null),
      }).unknown().required(),
    }), { convert: false });

    if (error) {
      let message = 'Cannot properly read the ".forestadmin-schema.json" file:\n - ';
      message += error.details.map((detail) => detail.message).join('\n - ');
      this.error(message, { exit: 20 });
    }

    return new SchemaSerializer().perform(schema.collections, schema.meta);
  }

  getEnvironmentSecret(parsedFlags) {
    let secret;

    if (parsedFlags.secret) {
      secret = parsedFlags.secret;
    } else if (process.env.FOREST_ENV_SECRET) {
      this.log('Using the forest environment secret found in the environment variable "FOREST_ENV_SECRET"');
      secret = process.env.FOREST_ENV_SECRET;
    } else {
      this.error('Cannot find your forest environment secret in the environment variable "FOREST_ENV_SECRET".\nPlease set the "FOREST_ENV_SECRET" variable or pass the secret in parameter using --secret.', { exit: 2 });
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
