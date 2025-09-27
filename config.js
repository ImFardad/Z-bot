require('dotenv').config();

module.exports = {
  token: process.env.TELEGRAM_TOKEN,
  adminId: process.env.ADMIN_USER_ID,
};
