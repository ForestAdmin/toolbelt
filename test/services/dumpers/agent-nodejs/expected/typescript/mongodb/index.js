require('dotenv').config();
const { createAgent } = require('@forestadmin/agent');
const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');
const primaryConnection = require('./models/primary');

// Create the Forest Admin agent.
/**
 * @type {import('@forestadmin/agent').Agent<import('./typings').Schema>}
 */
const agent = createAgent({
  authSecret: process.env.FOREST_AUTH_SECRET,
  envSecret: process.env.FOREST_ENV_SECRET,
  isProduction: process.env.NODE_ENV === 'production',
  // Autocompletion of collection names and fields
  typingsPath: './typings.ts',
  typingsMaxDepth: 5,
})
  // Connect your datasources.
  .addDataSource(createMongooseDataSource(primaryConnection, { flattenMode: 'auto' }));

// Add customizations here.
// agent.customizeCollection('collectionName', collection => ...);

agent
  // Expose an HTTP endpoint.
  .mountOnStandaloneServer(process.env.PORT || process.env.APPLICATION_PORT)
  // Start the agent.
  .start();
