export default (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    telegram_id: { type: DataTypes.BIGINT, unique: true },
    balance_sol: { type: DataTypes.FLOAT, defaultValue: parseFloat(process.env.DEFAULT_SOL || '1.0') },
    speed_mode: { type: DataTypes.ENUM('turbo','fast','normal','slow'), defaultValue: 'normal' }
  }, {
    tableName: 'users',
    underscored: true
  });
  return User;
};
