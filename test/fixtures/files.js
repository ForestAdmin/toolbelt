module.exports = {
  forestadminSchema: `{
    "meta": {
      "liana": "forest-express-sequelize",
      "orm_version": "3.24.8",
      "database_type": "postgres",
      "liana_version": "2.16.9"
    },
    "collections": [
      {
        "name": "Users",
        "idField": "id",
        "primaryKeys": [
          "id"
        ],
        "isCompositePrimary": false,
        "fields": [
          {
            "field": "id",
            "type": "Number",
            "columnName": "id",
            "primaryKey": true
          },
          {
            "field": "createdAt",
            "type": "Date",
            "columnName": "createdAt"
          }
        ],
        "isSearchable": true
      }
    ]
  }`,
  forestadminSchemaSnake: `{
    "meta": {
      "liana": "forest-express-sequelize",
      "orm_version": "3.24.8",
      "database_type": "postgres",
      "liana_version": "2.16.9"
    },
    "collections": [
      {
        "name": "Users",
        "id_field": "id",
        "primary_keys": [
          "id"
        ],
        "is_composite_primary": false,
        "fields": [
          {
            "field": "id",
            "type": "Number",
            "column_name": "id",
            "primary_key": true
          },
          {
            "field": "createdAt",
            "type": "Date",
            "column_name": "createdAt"
          }
        ],
        "is_searchable": true
      }
    ]
  }`,
  forestadminNewMetaFormat: `{
    "meta": {
      "liana": "forest-express-sequelize",
      "liana_version": "2.16.9",
      "stack": {
        "orm_version": "3.24.8",
        "database_type": "postgres"
      }
    },
    "collections": [
      {
        "name": "Users",
        "id_field": "id",
        "primary_keys": [
          "id"
        ],
        "is_composite_primary": false,
        "fields": [
          {
            "field": "id",
            "type": "Number",
            "column_name": "id",
            "primary_key": true
          },
          {
            "field": "createdAt",
            "type": "Date",
            "column_name": "createdAt"
          }
        ],
        "is_searchable": true
      }
    ]
  }`,
  forestadminWrongMetaFormat: `{
    "meta": {
      "liana": "forest-express-sequelize",
      "liana_version": "2.16.9",
      "orm_version": "3.24.8",
      "database_type": "postgres",
      "stack": {
        "orm_version": "3.24.8",
        "database_type": "postgres"
      }
    },
    "collections": [
      {
        "name": "Users",
        "id_field": "id",
        "primary_keys": [
          "id"
        ],
        "is_composite_primary": false,
        "fields": [
          {
            "field": "id",
            "type": "Number",
            "column_name": "id",
            "primary_key": true
          },
          {
            "field": "createdAt",
            "type": "Date",
            "column_name": "createdAt"
          }
        ],
        "is_searchable": true
      }
    ]
  }`,
};
