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
    // Always ensure the user exists in the database first
    await User.upsert({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name || null,
      username: user.username || null,
    });
    console.log(`User ${user.id} (${user.first_name}) is present in the database.`);

    // --- Group Logic ---
    if (chatType === 'group' || chatType === 'supergroup') {
      await Shelter.upsert({ id: chatId, name: msg.chat.title });
      console.log(`Shelter ${chatId} (${msg.chat.title}) is present in the database.`);
      await UserPossibleShelter.findOrCreate({ where: { userId: user.id, shelterId: chatId } });
      console.log(`Shelter ${chatId} marked as possible for user ${user.id}.`);
      await bot.sendMessage(chatId, `🏕️ این گروه اکنون به عنوان یک پناهگاه ثبت شده است!\n\nاعضای گروه می‌توانند در چت خصوصی با من، از طریق منوی «پناهگاه»، به اینجا ملحق شوند.`);
      return;
    }

    // --- Private Chat Logic (with Active Menu Tracking) ---
    
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
