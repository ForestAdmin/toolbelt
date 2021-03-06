const Sequelize = require('sequelize');

module.exports = {
  default_values: {
    fields: [
      {
        name: "boolNull",
        nameColumn: "bool_null",
        type: "BOOLEAN",
        primaryKey: false,
        defaultValue: null,
        isRequired: false,
      },
      {
        name: "boolCst",
        nameColumn: "bool_cst",
        type: "BOOLEAN",
        primaryKey: false,
        defaultValue: true,
        isRequired: false,
      },
      {
        name: "intCst",
        nameColumn: "int_cst",
        type: "INTEGER",
        primaryKey: false,
        defaultValue: 42,
        isRequired: false,
      },
      {
        name: "strNull",
        nameColumn: "str_null",
        type: "STRING",
        primaryKey: false,
        defaultValue: null,
        isRequired: false,
      },
      {
        name: "strCst",
        nameColumn: "str_cst",
        type: "STRING",
        primaryKey: false,
        defaultValue: 'co\'nst\'ant',
        isRequired: false,
      },
      {
        name: "strExpr",
        nameColumn: "str_expr",
        type: "STRING",
        primaryKey: false,
        defaultValue: Sequelize.literal("upper(('Hello'::text || 'World'::text))"),
        isRequired: false,
      },
      {
        name: "dateNull",
        nameColumn: "date_null",
        type: "DATE",
        primaryKey: false,
        defaultValue: null,
        isRequired: false,
      },
      {
        name: "dateCst1",
        nameColumn: "date_cst1",
        type: "DATE",
        primaryKey: false,
        defaultValue: '2010-01-01 00:00:00',
        isRequired: false,
      },
      {
        name: "dateCst2",
        nameColumn: "date_cst2",
        type: "DATE",
        primaryKey: false,
        defaultValue: '1983-05-27 00:00:00',
        isRequired: false,
      },
      {
        name: "dateExpr1",
        nameColumn: "date_expr1",
        type: "DATE",
        primaryKey: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        isRequired: false,
      },
      {
        name: "dateExpr2",
        nameColumn: "date_expr2",
        type: "DATE",
        primaryKey: false,
        defaultValue: Sequelize.literal("now()"),
        isRequired: false,
      },
      {
        name: "dateExpr3",
        nameColumn: "date_expr3",
        type: "DATE",
        primaryKey: false,
        defaultValue: Sequelize.literal("timezone('utc'::text, now())"),
        isRequired: false,
      },
      {
        defaultValue: null,
        isRequired: false,
        name: "enumCst1",
        nameColumn: "enum_cst1",
        primaryKey: false,
        type: "ENUM(\n        'a',\n        'b',\n        'c',\n      )",
      },
      {
        defaultValue: 'a',
        isRequired: false,
        name: "enumCst2",
        nameColumn: "enum_cst2",
        primaryKey: false,
        type: "ENUM(\n        'a',\n        'b',\n        'c',\n      )",
      },
      {
        name: "arrayCst1",
        nameColumn: "array_cst1",
        type: "ARRAY(DataTypes.INTEGER)",
        primaryKey: false,
        defaultValue: Sequelize.literal("'{25000,25000,27000,27000}'::integer[]"),
        isRequired: false,
      },
      {
        name: "arrayCst2",
        nameColumn: "array_cst2",
        type: "ARRAY(DataTypes.INTEGER)",
        primaryKey: false,
        defaultValue: Sequelize.literal("ARRAY[25000, 25000, 27000, 27000]"),
        isRequired: false,
      },
      {
        name: "jsonCst",
        nameColumn: "json_cst",
        type: "JSON",
        primaryKey: false,
        defaultValue: { a: 1, b: 2 },
        isRequired: false,
      },
      {
        name: "jsonbCst",
        nameColumn: "jsonb_cst",
        type: "JSONB",
        primaryKey: false,
        defaultValue: { a: 1, b: 2 },
        isRequired: false,
      },
    ],
    primaryKeys: [
      "id",
    ],
    options: {
      underscored: false,
      timestamps: false,
      hasIdColumn: true,
      hasPrimaryKeys: true,
      isJunction: false,
    },
    references: [
    ],
  }
};
