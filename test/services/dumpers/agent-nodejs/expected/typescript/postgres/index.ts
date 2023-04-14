import type { Schema } from './typings';

import 'dotenv/config';
import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';

const dialectOptions: { [name: string]: any } = {};

if (process.env.DATABASE_SSL && JSON.parse(process.env.DATABASE_SSL.toLowerCase())) {
  // Set to false to bypass SSL certificate verification (useful for self-signed certificates).
  const rejectUnauthorized =
    process.env.DATABASE_REJECT_UNAUTHORIZED &&
    JSON.parse(process.env.DATABASE_REJECT_UNAUTHORIZED.toLowerCase());
  dialectOptions.ssl = rejectUnauthorized ? true : { require: true, rejectUnauthorized };
}

// This object allows to configure your Forest Admin panel
const agent = createAgent<Schema>({
  // Security tokens
  authSecret: process.env.FOREST_AUTH_SECRET!,
  envSecret: process.env.FOREST_ENV_SECRET!,

  // Make sure to set NODE_ENV to 'production' when you deploy your project
  isProduction: process.env.NODE_ENV === 'production',

  // Autocompletion of collection names and fields
  typingsPath: './typings.ts',
  typingsMaxDepth: 5,
});

// Connect your datasources
// All options are documented at https://docs.forestadmin.com/developer-guide-agents-nodejs/data-sources/connection
agent.addDataSource(
  createSqlDataSource({
    uri: process.env.DATABASE_URL,
    schema: process.env.DATABASE_SCHEMA,
    dialectOptions,
  }),
);

// Add customizations here.
// For instance, you can code custom actions, charts, create new fields or relationships, load plugins.
// As your project grows, you will need to split it into multiple files!
//
// Here is some code to get your started
//
// agent.customizeCollection('products', (collection: CollectionCustomizer<Schema, 'products'>) => {
//   // Actions are documented here:
//   // https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/actions
//   collection.addAction('Order new batch from supplier', {
//     scope: 'Single', // This action can be triggered product by product
//     form: [{ label: 'Quantity', type: 'Number', isRequired: true }],
//     execute: async (context, resultBuilder) => {
//       const product = await context.getRecord(['id', 'name'])
//       const quantity = context.formValues['Quantity'];

//       // ... Perform work here ...

//       return resultBuilder.success(`Your order for a batch of ${quantity} '${product.name}' was sent`);
//     }
//   });

//   // Search customization is documented here:
//   // https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/search
//   collection.replaceSearch(searchString => {
//     // user has typed a product id, let's only that column
//     if (searchString.match(/^prdid[\d]{8}/$))
//       return { field: 'id', operator: 'Equal', value: searchString };

//     // Otherwise assume that user wants to search for a product by name
//     return { field: 'name', operator: 'Contains', value: searchString };
//   });
// });

// Expose an HTTP endpoint.
agent.mountOnStandaloneServer(Number(process.env.APPLICATION_PORT));

// Start the agent.
agent.start().catch(error => {
  console.error('\x1b[31merror:\x1b[0m Forest Admin agent failed to start\n');
  console.error('');
  console.error(error.stack);
  process.exit(1);
});
