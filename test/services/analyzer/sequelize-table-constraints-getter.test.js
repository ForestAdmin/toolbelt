const _ = require('lodash');
const SequelizeHelper = require('./helpers/sequelize-helper');
const { describeSequelizeDatabases } = require('./helpers/multiple-database-version-helper');
const TableConstraintsGetter = require('../../../src/services/schema/update/analyzer/sequelize-table-constraints-getter');
const expectedAddressesConstraints = require('./expected/sequelize/constraints-getter-output/addresses.expected');
const expectedCustomersConstraints = require('./expected/sequelize/constraints-getter-output/customers.expected');
const expectedReviewsConstraints = require('./expected/sequelize/constraints-getter-output/reviews.expected');

async function createConnection(connectionUrl) {
  const sequelizeHelper = new SequelizeHelper();
  const databaseConnection = await sequelizeHelper.connect(connectionUrl);
  await sequelizeHelper.dropAndCreate('users');
  await sequelizeHelper.dropAndCreate('books');
  await sequelizeHelper.dropAndCreate('customers');
  await sequelizeHelper.dropAndCreate('addresses');
  await sequelizeHelper.dropAndCreate('reviews');
  return { databaseConnection, sequelizeHelper };
}

async function cleanConnection(sequelizeHelper) {
  return sequelizeHelper.close();
}

describe('services > sequelize table constraints getter', () => {
  describeSequelizeDatabases(({ connectionUrl, dialect, schema }) => () => {
    it('should provide the constraints of a table with one unique constraint', async () => {
      expect.assertions(1);
      const { databaseConnection, sequelizeHelper } = await createConnection(connectionUrl);
      const tableConstraintsGetter = new TableConstraintsGetter(databaseConnection, schema);
      const constraints = await tableConstraintsGetter.perform('addresses');

      expect(_.sortBy(constraints, ['constraintName'])).toStrictEqual(
        _.sortBy(expectedAddressesConstraints[dialect], ['constraintName']),
      );
      await cleanConnection(sequelizeHelper);
    });

    it('should provide the constraints of a table without any unique constraint', async () => {
      expect.assertions(1);
      const { databaseConnection, sequelizeHelper } = await createConnection(connectionUrl);
      const tableConstraintsGetter = new TableConstraintsGetter(databaseConnection, schema);
      const constraints = await tableConstraintsGetter.perform('customers');

      expect(_.sortBy(constraints, ['constraintName'])).toStrictEqual(
        _.sortBy(expectedCustomersConstraints[dialect], ['constraintName']),
      );
      await cleanConnection(sequelizeHelper);
    });

    it('should provide the constraints of a table with a composite unique constraint', async () => {
      expect.assertions(3);
      const { databaseConnection, sequelizeHelper } = await createConnection(connectionUrl);
      const sortingFields = [
        'constraintName',
        'tableName',
        'columnType',
        'columnName',
        'foreignTableName',
        'foreignColumnName',
      ];
      const tableConstraintsGetter = new TableConstraintsGetter(databaseConnection, schema);
      const constraints = await tableConstraintsGetter.perform('reviews');
      const sortedConstraints = _.sortBy(constraints, sortingFields);
      const expectedSortedConstraints = _.sortBy(
        expectedReviewsConstraints[dialect],
        sortingFields,
      );

      // NOTICE: Get an array of unique indexes for the table (MySQL doesn't order json aggregates)
      function extractUniqueIndexes(constraintsToExtract) {
        return _.compact(
          _.flatten(
            _.uniqWith(
              constraintsToExtract.map(constraint => constraint.uniqueIndexes),
              _.isEqual,
            ),
          ),
        );
      }

      const uniqueIndexesList = extractUniqueIndexes(sortedConstraints);
      const expectedUniqueIndexes = extractUniqueIndexes(expectedSortedConstraints);

      // NOTICE: Compare the lists of unique indexes
      expect(uniqueIndexesList).toHaveLength(expectedUniqueIndexes.length);
      uniqueIndexesList.forEach((uniqueIndex, index) =>
        expect(uniqueIndex.sort()).toStrictEqual(expectedUniqueIndexes[index].sort()),
      );

      // NOTICE: Compare the other objects
      expect(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        sortedConstraints.map(({ uniqueIndexes, ...otherFields }) => otherFields),
      ).toStrictEqual(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        expectedSortedConstraints.map(({ uniqueIndexes, ...otherFields }) => otherFields),
      );
      await cleanConnection(sequelizeHelper);
    });
  });
});
