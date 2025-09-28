const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const User = sequelize.define(
  'User',
  {
    // Telegram User ID will be the primary key
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true, // lastName is optional
    },
    username: {
      type: DataTypes.STRING,
      allowNull: true, // username is optional
    },
    survivalPercentage: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    shelterId: {
      type: DataTypes.BIGINT,
      allowNull: true, // A user might not have a shelter
      references: {
        model: 'Shelters', // This is the table name, which is pluralized by Sequelize
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
  },
  {
    // Model options
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

module.exports = User;
