const TelegramBot = require('node-telegram-bot-api');
const { token } = require('./config');
const { handleStart } = require('./handlers/startHandler');
const { handleMenuCallback } = require('./handlers/menuHandler');
const { handleZombieSolution } = require('./handlers/zombieHandler');
const { handleListShelterMembers } = require('./handlers/shelterHandler');
const sequelize = require('./db/database');

async function startBot() {
  if (!token) {
    console.error('Error: TELEGRAM_TOKEN is not defined in the .env file.');
    process.exit(1);
  }

  // Define model associations
  const User = require('./db/User');
  const Shelter = require('./db/Shelter');
  const UserPossibleShelter = require('./db/UserPossibleShelter');
  require('./db/UserQuestionHistory'); // This model has no associations, just needs to be registered

  // A user can belong to one Shelter
  Shelter.hasMany(User, { foreignKey: 'shelterId' });
  User.belongsTo(Shelter, { foreignKey: 'shelterId' });

  // A user can have many possible shelters, and a shelter can have many possible users
  User.belongsToMany(Shelter, { through: UserPossibleShelter, foreignKey: 'userId', as: 'PossibleShelters' });
  Shelter.belongsToMany(User, { through: UserPossibleShelter, foreignKey: 'shelterId' });

  // Initialize and synchronize the database
  try {
    await sequelize.sync({ alter: true });
    console.log('Database synchronized successfully.');
  } catch (error) {
    console.error('Unable to synchronize the database:', error);
    process.exit(1);
  }

  const bot = new TelegramBot(token, { polling: true });

  // Get bot info and store username
  const botInfo = await bot.getMe();
  bot.botUsername = botInfo.username;
  console.log(`Bot username: @${bot.botUsername}`);

  // Set bot commands
  await bot.setMyCommands([
    { command: 'start', description: 'شروع کار با ربات و ثبت پناهگاه' },
    { command: 'shelter_members', description: 'نمایش لیست اعضای پناهگاه (فقط در گروه)' },
  ]);
  console.log('Bot commands set successfully.');

  // Handler for the /start command
  bot.onText(/\/start/, (msg) => handleStart(bot, msg));

  // Handler for the /shelter_members command
  bot.onText(/\/shelter_members/, (msg) => handleListShelterMembers(bot, msg));

  // Listener for general messages to handle zombie solutions
  bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) {
      return;
    }
    // All non-command messages are assumed to be zombie solutions
    await handleZombieSolution(bot, msg);
  });

  // General handler for all callback queries
  bot.on('callback_query', (callbackQuery) => {
    handleMenuCallback(bot, callbackQuery);
  });

  // Polling error listener
  bot.on('polling_error', (error) => {
    console.error(`Polling Error: [${error.code}] ${error.message}`);
  });

  console.log('Bot has started successfully and is polling for updates.');
}

module.exports = { startBot };
