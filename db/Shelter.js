const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Shelter = sequelize.define(
  'Shelter',
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    province: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
      preciseLocation: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      treasury: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },  },
  {
    timestamps: true,
  }
);

module.exports = Shelter;
