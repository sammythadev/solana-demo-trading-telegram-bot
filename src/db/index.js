import { Sequelize } from 'sequelize';
import { DATABASE_URL } from '../config/database.js';
import UserModel from './models/User.js';
import PositionModel from './models/Position.js';
import TransactionModel from './models/Transaction.js';

let sequelize;
let cachedModels = null;

export const initDB = async () => {
  // Return cached instance if already initialized
  if (sequelize && cachedModels) {
    return { sequelize, models: cachedModels };
  }

  sequelize = new Sequelize(DATABASE_URL, { logging: false });
  // init models (create only once)
  const User = UserModel(sequelize, Sequelize.DataTypes);
  const Position = PositionModel(sequelize, Sequelize.DataTypes);
  const Transaction = TransactionModel(sequelize, Sequelize.DataTypes);

  // associations
  User.hasMany(Position, { foreignKey: 'user_id' });
  Position.belongsTo(User, { foreignKey: 'user_id' });
  User.hasMany(Transaction, { foreignKey: 'user_id' });

  // sync models (do not auto-alter enums/column types which can fail on Postgres)
  // Using plain sync avoids runtime ALTERs that may error when enum types differ.
  await sequelize.sync();
  console.log('Database synced');

  cachedModels = { User, Position, Transaction };
  return { sequelize, models: cachedModels };
};
