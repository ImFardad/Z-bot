const { menus } = require('../keyboards/inlineKeyboards');
const User = require('../db/User');
const Shelter = require('../db/Shelter');
const UserPossibleShelter = require('../db/UserPossibleShelter');

// In-memory store for active menu messages { [chatId]: messageId }
const activeMenuMessages = {};

async function handleStart(bot, msg) {
  const chatId = msg.chat.id;
  const user = msg.from;
  const chatType = msg.chat.type;

  try {
    // --- Group Logic ---
    if (chatType === 'group' || chatType === 'supergroup') {
      const userRecord = await User.findByPk(user.id);
      if (!userRecord) {
        try {
          await bot.sendMessage(chatId, 'برای استفاده از امکانات ربات در گروه، ابتدا باید ربات را در چت خصوصی استارت کنید.', { reply_to_message_id: msg.message_id });
        } catch(e) { console.error(e); }
      } else {
        await bot.sendMessage(chatId, 'برای استفاده از ربات در چت خصوصی به من پیام دهید. برای ساخت پناهگاه در گروه از دستور /shelter استفاده کنید.');
      }
      return;
    }

    // --- Private Chat Logic (with Active Menu Tracking) ---
    // User is starting the bot privately, so we create or update their record.
    await User.upsert({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name || null,
      username: user.username || null,
    });
    
    // 1. If an old menu message exists, delete it.
    if (activeMenuMessages[chatId]) {
      try {
        await bot.deleteMessage(chatId, activeMenuMessages[chatId]);
      } catch (e) {
        // Ignore if the message was already deleted by the user
        console.log(`Could not delete old menu message ${activeMenuMessages[chatId]}:`, e.message);
      }
    }

    // 2. Send the new menu message.
    const mainMenu = menus.main;
    const welcomeText = mainMenu.text(user.first_name);
    const sentMessage = await bot.sendMessage(chatId, welcomeText, mainMenu.options(user.id));

    // 3. Store the new message's ID as the active one.
    activeMenuMessages[chatId] = sentMessage.message_id;

  } catch (error) {
    console.error('Error in handleStart:', error);
    try {
      await bot.sendMessage(chatId, 'خطایی در پردازش درخواست شما رخ داد.');
    } catch (e) {
      console.error('Failed to send error message in handleStart:', e);
    }
  }
}

module.exports = { handleStart, activeMenuMessages };
