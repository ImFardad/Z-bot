const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const User = require('./User');

const UserQuestionHistory = sequelize.define('UserQuestionHistory', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  question: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'general',
  },
});

// Define the association
User.hasMany(UserQuestionHistory, { foreignKey: 'userId' });
UserQuestionHistory.belongsTo(User, { foreignKey: 'userId' });

module.exports = UserQuestionHistory;
