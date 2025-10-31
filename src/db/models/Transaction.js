export default (sequelize, DataTypes) => {
  const Transaction = sequelize.define('Transaction', {
    type: { type: DataTypes.ENUM('buy','sell','topup') },
    token_address: { type: DataTypes.TEXT },
    sol_amount: { type: DataTypes.FLOAT },
    pnl_usd: { type: DataTypes.FLOAT }
  }, {
    tableName: 'transactions',
    underscored: true
  });
  return Transaction;
};
