const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const User = require('./User');

const DailyPurchase = sequelize.define(
  'DailyPurchase',
  {
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
    itemType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    purchaseDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    timestamps: false,
  }
);

User.hasMany(DailyPurchase, { foreignKey: 'userId' });
DailyPurchase.belongsTo(User, { foreignKey: 'userId' });

module.exports = DailyPurchase;
