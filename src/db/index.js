import { Sequelize } from 'sequelize';
import { DATABASE_URL, DB_POOL } from '../config/database.js';
import { ENV } from '../config/env.js';
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

  // Create Sequelize with explicit pool settings to avoid creating many
  // connections under load and to play nicely with external poolers like
  // pgbouncer. Keep benchmark true to help measure slow queries in logs.
  sequelize = new Sequelize(DATABASE_URL, {
    logging: false,
    benchmark: true,
    pool: DB_POOL,
    dialectOptions: {
      // keep connections alive where supported
      keepAlive: true,
    },
    define: {
      // keep table names and fields predictable
      freezeTableName: true,
      underscored: true,
    },
  });
  // init models (create only once)
  const User = UserModel(sequelize, Sequelize.DataTypes);
  const Position = PositionModel(sequelize, Sequelize.DataTypes);
  const Transaction = TransactionModel(sequelize, Sequelize.DataTypes);

  // associations
  User.hasMany(Position, { foreignKey: 'user_id' });
  Position.belongsTo(User, { foreignKey: 'user_id' });
  User.hasMany(Transaction, { foreignKey: 'user_id' });

  // In production we avoid automatic `sync()` to prevent unexpected schema
  // changes and reduce startup time. Instead, authenticate the connection.
  const isProd = ENV.NODE_ENV === 'production';

  // Attempt to authenticate with a few retries to be robust on flaky infra.
  const maxAttempts = 3;
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      await sequelize.authenticate();
      break;
    } catch (err) {
      attempt += 1;
      const wait = 500 * attempt; // backoff
      console.warn(`DB auth attempt ${attempt} failed, retrying in ${wait}ms`);
      if (attempt >= maxAttempts) {
        console.error('Failed to authenticate to DB:', err);
        throw err;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, wait));
    }
  }

  if (!isProd) {
    // In non-production (dev/test) environments keep the convenience of sync()
    // but avoid altering enums/column types implicitly in production.
    await sequelize.sync();
    console.log('Database synced (dev mode)');
  } else {
    console.log('Database authenticated (production mode)');
  }

  cachedModels = { User, Position, Transaction };
  return { sequelize, models: cachedModels };
};
