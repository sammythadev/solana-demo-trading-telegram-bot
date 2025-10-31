export default (sequelize, DataTypes) => {
  const Position = sequelize.define('Position', {
    token_address: { type: DataTypes.TEXT },
    symbol: { type: DataTypes.TEXT },
    buy_price: { type: DataTypes.FLOAT },
    amount_tokens: { type: DataTypes.FLOAT },
    sol_spent: { type: DataTypes.FLOAT }
  }, {
    tableName: 'positions',
    underscored: true
  });
  return Position;
};
