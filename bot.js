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
  bot.onText(/\/start/, async (msg) => {
    try {
      await handleStart(bot, msg);
    } catch (error) {
      console.error("Unhandled error in handleStart:", error);
    }
  });

  // Handler for the /shelter_members command
  bot.onText(/\/shelter_members/, async (msg) => {
    try {
      await handleListShelterMembers(bot, msg);
    } catch (error) {
      console.error("Unhandled error in handleListShelterMembers:", error);
    }
  });

  // Listener for general messages to handle zombie solutions
  bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) {
      return;
    }
    try {
      // All non-command messages are assumed to be zombie solutions
      await handleZombieSolution(bot, msg);
    } catch (error) {
      console.error("Unhandled error in message handler:", error);
    }
  });

  // General handler for all callback queries
  bot.on('callback_query', (callbackQuery) => {
    handleMenuCallback(bot, callbackQuery);
  });

  // Handler for when the bot is removed from a group
  bot.on('left_chat_member', async (msg) => {
    const leftMember = msg.left_chat_member;
    if (leftMember && leftMember.id === botInfo.id) {
      const chatId = msg.chat.id;
      console.log(`Bot was removed from group ${chatId}. Cleaning up shelter data.`);

      try {
        // Set shelterId to null for all users in this shelter
        const [updatedUsersCount] = await User.update(
          { shelterId: null },
          { where: { shelterId: chatId } }
        );
        if (updatedUsersCount > 0) {
          console.log(`Removed ${updatedUsersCount} users from shelter ${chatId}.`);
        }

        // Remove the shelter from all users' "possible shelters" list
        const deletedPossibleCount = await UserPossibleShelter.destroy({
          where: { shelterId: chatId },
        });
        if (deletedPossibleCount > 0) {
          console.log(`Removed shelter ${chatId} from ${deletedPossibleCount} users' possible lists.`);
        }
      } catch (error) {
        console.error(`Failed to clean up data for shelter ${chatId}:`, error);
      }
    }
  });

  // Polling error listener
  bot.on('polling_error', (error) => {
    console.error(`Polling Error: [${error.code}] ${error.message}`);
  });

  console.log('Bot has started successfully and is polling for updates.');
}

module.exports = { startBot };
