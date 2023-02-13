module.exports = {
  DATABASE_URL_MONGODB_MIN: 'mongodb://localhost:27015',
  DATABASE_URL_MONGODB_MAX: 'mongodb://localhost:27016',
  DATABASE_URL_MSSQL_MIN: 'mssql://sa:forest2019:@localhost:1431/model',
  DATABASE_URL_MSSQL_MAX: 'mssql://sa:forest2019:@localhost:1432/model',
  DATABASE_URL_MYSQL_MIN:
    'mysql://forest:secret@localhost:8998/forestadmin_test_toolbelt-sequelize',
  DATABASE_URL_MYSQL_MAX:
    'mysql://forest:secret@localhost:8999/forestadmin_test_toolbelt-sequelize',
  DATABASE_URL_POSTGRESQL_MIN:
    'postgres://forest:secret@localhost:54368/forestadmin_test_toolbelt-sequelize',
  DATABASE_URL_POSTGRESQL_MAX:
    'postgres://forest:secret@localhost:54369/forestadmin_test_toolbelt-sequelize',
};
