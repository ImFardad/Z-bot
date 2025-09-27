const TelegramBot = require('node-telegram-bot-api');
const { token } = require('./config');
const { handleStart } = require('./handlers/startHandler');
const { handleMenuCallback } = require('./handlers/menuHandler');
const { handleCreateShelterCommand, handleCreationReply, handleCreationCallback, handleShelterJoinCallback } = require('./handlers/shelterCreationHandler');
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
  require('./db/UserQuestionHistory');

  Shelter.hasMany(User, { foreignKey: 'shelterId' });
  User.belongsTo(Shelter, { foreignKey: 'shelterId' });

  User.belongsToMany(Shelter, { through: UserPossibleShelter, foreignKey: 'userId', as: 'PossibleShelters' });
  Shelter.belongsToMany(User, { through: UserPossibleShelter, foreignKey: 'shelterId' });

  try {
    await sequelize.sync({ alter: true });
    console.log('Database synchronized successfully.');
  } catch (error) {
    console.error('Unable to synchronize the database:', error);
    process.exit(1);
  }

  const bot = new TelegramBot(token, { polling: true });

  const botInfo = await bot.getMe();
  bot.botUsername = botInfo.username;
  console.log(`Bot username: @${bot.botUsername}`);

  await bot.setMyCommands([
    { command: 'start', description: 'شروع کار با ربات (فقط در چت خصوصی)' },
    { command: 'shelter', description: 'ایجاد یا نمایش اطلاعات پناهگاه (فقط در گروه)' },
  ]);
  console.log('Bot commands set successfully.');

  bot.onText(/\/start/, (msg) => handleStart(bot, msg));
  bot.onText(/\/shelter/, (msg) => handleCreateShelterCommand(bot, msg));

  bot.on('message', async (msg) => {
    // Ignore commands, they are handled by onText
    if (msg.text && msg.text.startsWith('/')) return;

    // 1. Handle shelter creation replies
    const creationHandled = await handleCreationReply(bot, msg);
    if (creationHandled) return;

    // 2. Handle zombie solutions (if not a creation reply)
    try {
      await handleZombieSolution(bot, msg);
    } catch (error) {
      console.error("Unhandled error in zombie solution handler:", error);
    }
  });

  bot.on('callback_query', async (callbackQuery) => {
    // 1. Handle shelter join callbacks
    const joinCallbackHandled = await handleShelterJoinCallback(bot, callbackQuery);
    if (joinCallbackHandled) return;

    // 2. Handle shelter creation callbacks
    const creationCallbackHandled = await handleCreationCallback(bot, callbackQuery);
    if (creationCallbackHandled) return;

    // 3. Handle menu callbacks (if not a creation callback)
    await handleMenuCallback(bot, callbackQuery);
  });

  bot.on('left_chat_member', async (msg) => {
    if (msg.left_chat_member && msg.left_chat_member.id === botInfo.id) {
      const chatId = msg.chat.id;
      console.log(`Bot was removed from group ${chatId}. Deleting shelter and associated data.`);
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

        // Finally, delete the shelter itself
        const shelter = await Shelter.findByPk(chatId);
        if (shelter) {
          await shelter.destroy();
          console.log(`Shelter ${chatId} deleted.`);
        }
      } catch (error) {
        console.error(`Failed to clean up data for shelter ${chatId}:`, error);
      }
    }
  });

  bot.on('polling_error', (error) => {
    console.error(`Polling Error: [${error.code}] ${error.message}`);
  });

  console.log('Bot has started successfully and is polling for updates.');
}

module.exports = { startBot };
