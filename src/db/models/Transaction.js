export default (sequelize, DataTypes) => {
  const Transaction = sequelize.define('Transaction', {
    type: { type: DataTypes.ENUM('buy','sell','topup') },
    token_address: { type: DataTypes.TEXT },
    token_symbol: { type: DataTypes.TEXT },
    token_amount: { type: DataTypes.FLOAT },
    price_usd: { type: DataTypes.FLOAT },
    total_usd: { type: DataTypes.FLOAT },
    sol_amount: { type: DataTypes.FLOAT },
    pnl_usd: { type: DataTypes.FLOAT }
  }, {
    tableName: 'transactions',
    underscored: true
  });
  return Transaction;
};
