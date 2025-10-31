import { Sequelize } from 'sequelize';
import { DATABASE_URL } from '../config/database.js';
import UserModel from './models/User.js';
import PositionModel from './models/Position.js';
import TransactionModel from './models/Transaction.js';

let sequelize;

export const initDB = async () => {
  sequelize = new Sequelize(DATABASE_URL, { logging: false });
  // init models
  const User = UserModel(sequelize, Sequelize.DataTypes);
  const Position = PositionModel(sequelize, Sequelize.DataTypes);
  const Transaction = TransactionModel(sequelize, Sequelize.DataTypes);

  // associations
  User.hasMany(Position, { foreignKey: 'user_id' });
  Position.belongsTo(User, { foreignKey: 'user_id' });
  User.hasMany(Transaction, { foreignKey: 'user_id' });

  await sequelize.sync();
  console.log('Database synced');
  return { sequelize, models: { User, Position, Transaction } };
};
