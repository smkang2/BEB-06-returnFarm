// import dorenv from 'dotenv';
// dotenv.config();
// const env = process.env;
const Sequelize = require("sequelize");
const env = process.env.NODE_ENV || "development";
const config = require("../config/settings")[env];

//? 모델 모듈
const User = require("./user");
const Bag = require("./bag");
const Rand = require("./rand");
const Market_item = require("./market_item");
const Market_nft = require("./market_nft");

const db = {};
const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config
);

//? db객체에 모델 정보들 넣음
db.sequelize = sequelize;
db.User = User;
db.Bag = Bag;
db.Rand = Rand;
db.Market_item = Market_item;
db.Market_nft = Market_nft;

//? 모델 - 테이블 연결
User.init(sequelize);
Bag.init(sequelize);
Rand.init(sequelize);
Market_item.init(sequelize);
Market_nft.init(sequelize);

//? 모델 관계 설정
// User.associate(db);
// Inventory.associate(db);

module.exports = { db, sequelize };