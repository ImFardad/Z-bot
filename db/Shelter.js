const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Shelter = sequelize.define('Shelter', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  timestamps: true,
});

module.exports = Shelter;
