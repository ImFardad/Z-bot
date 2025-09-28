const TelegramBot = require('node-telegram-bot-api');
const { token } = require('./config');
const { handleStart } = require('./handlers/startHandler');
const { handleMenuCallback } = require('./handlers/menuHandler');
const {
  handleCreateShelterCommand,
  handleCreationReply,
  handleCreationCallback,
  handleShelterJoinCallback,
} = require('./handlers/shelterCreationHandler');
const { handleZombieSolution } = require('./handlers/zombieHandler');
const sequelize = require('./db/database');

async function startBot() {
  if (!token) {
    console.error('Error: TELEGRAM_TOKEN is not defined in the .env file.');
    process.exit(1);
  }

  // Define model associations
  const User = require('./db/User');
  const Shelter = require('./db/Shelter');
  const ShopItem = require('./db/ShopItem');
  require('./db/UserQuestionHistory');

  Shelter.hasMany(User, { foreignKey: 'shelterId' });
  User.belongsTo(Shelter, { foreignKey: 'shelterId' });

  // Helper function to check if a user has started the bot
  async function isUserRegistered(userId) {
    const user = await User.findByPk(userId);
    return user !== null;
  }

  async function seedDatabase() {
    const defaultItems = [
      {
        name: 'کوله پشتی کوچک',
        description: 'یک کوله پشتی ساده با ظرفیت پایه.',
        price: 150,
        stock: null, // Infinite
        type: 'backpack',
        level: 1,
      },
      {
        name: 'ارتقا به کوله پشتی متوسط',
        description: 'افزایش ظرفیت کوله پشتی به سطح متوسط.',
        price: 200,
        stock: null, // Infinite
        type: 'backpack_upgrade',
        level: 2,
      },
      {
        name: 'ارتقا به کوله پشتی بزرگ',
        description: 'ارتقا کوله پشتی به آخرین سطح با بیشترین ظرفیت.',
        price: 250,
        stock: null, // Infinite
        type: 'backpack_upgrade',
        level: 3,
      },
    ];

    for (const item of defaultItems) {
      await ShopItem.findOrCreate({
        where: { type: item.type, level: item.level },
        defaults: item,
      });
    }
    console.log('Default shop items seeded successfully.');
  }

  try {
    await sequelize.sync();
    console.log('Database synchronized successfully.');
    await seedDatabase();
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
    {
      command: 'shelter',
      description: 'ایجاد یا نمایش اطلاعات پناهگاه (فقط در گروه)',
    },
  ]);
  console.log('Bot commands set successfully.');

  bot.onText(/\/start/, (msg) => handleStart(bot, msg));

  bot.onText(/\/shelter/, async (msg) => {
    const userExists = await isUserRegistered(msg.from.id);
    if (!userExists) {
      try {
        await bot.sendMessage(
          msg.chat.id,
          'برای استفاده از امکانات ربات در گروه، ابتدا باید ربات را در چت خصوصی استارت کنید.',
          { reply_to_message_id: msg.message_id }
        );
      } catch (e) {
        console.error(e);
      }
      return;
    }
    handleCreateShelterCommand(bot, msg);
  });

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
      console.error('Unhandled error in zombie solution handler:', error);
    }
  });

  bot.on('callback_query', async (callbackQuery) => {
    const userExists = await isUserRegistered(callbackQuery.from.id);
    if (!userExists) {
      try {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: 'برای استفاده از دکمه‌ها، ابتدا باید ربات را در چت خصوصی استارت کنید.',
          show_alert: true,
        });
      } catch (e) {
        console.error(e);
      }
      return;
    }

    // 1. Handle shelter join callbacks
    const joinCallbackHandled = await handleShelterJoinCallback(
      bot,
      callbackQuery
    );
    if (joinCallbackHandled) return;

    // 2. Handle shelter creation callbacks
    const creationCallbackHandled = await handleCreationCallback(
      bot,
      callbackQuery
    );
    if (creationCallbackHandled) return;

    // 3. Handle menu callbacks (if not a creation callback)
    await handleMenuCallback(bot, callbackQuery);
  });

  bot.on('left_chat_member', async (msg) => {
    if (msg.left_chat_member && msg.left_chat_member.id === botInfo.id) {
      const chatId = msg.chat.id;
      console.log(
        `Bot was removed from group ${chatId}. Deleting shelter and associated data.`
      );
      try {
        // Set shelterId to null for all users in this shelter
        const [updatedUsersCount] = await User.update(
          { shelterId: null },
          { where: { shelterId: chatId } }
        );
        if (updatedUsersCount > 0) {
          console.log(
            `Removed ${updatedUsersCount} users from shelter ${chatId}.`
          );
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
