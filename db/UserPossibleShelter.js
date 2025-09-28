const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const User = require('./User');
const Shelter = require('./Shelter');

const UserPossibleShelter = sequelize.define(
  'UserPossibleShelter',
  {
    userId: {
      type: DataTypes.BIGINT,
      references: {
        model: User,
        key: 'id',
      },
    },
    shelterId: {
      type: DataTypes.BIGINT,
      references: {
        model: Shelter,
        key: 'id',
      },
    },
  },
  {
    timestamps: false, // No need for timestamps on a simple join table
  }
);

module.exports = UserPossibleShelter;
