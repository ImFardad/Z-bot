const { menus } = require('../keyboards/inlineKeyboards');
const User = require('../db/User');
const Shelter = require('../db/Shelter');
const UserPossibleShelter = require('../db/UserPossibleShelter');

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
      // Register the group as a Shelter
      await Shelter.upsert({
        id: chatId,
        name: msg.chat.title,
      });
      console.log(`Shelter ${chatId} (${msg.chat.title}) is present in the database.`);

      // Mark this shelter as a "possible shelter" for the user
      await UserPossibleShelter.findOrCreate({
        where: {
          userId: user.id,
          shelterId: chatId,
        },
      });
      console.log(`Shelter ${chatId} marked as possible for user ${user.id}.`);

      // Send a confirmation message to the group
      bot.sendMessage(chatId, `🏕️ این گروه اکنون به عنوان یک پناهگاه ثبت شده است!\n\nاعضای گروه می‌توانند در چت خصوصی با من، از طریق منوی «پناهگاه»، به اینجا ملحق شوند.`);
      return; // Stop further execution for group messages
    }

    // --- Private Chat Logic ---
    const mainMenu = menus.main;
    const welcomeText = mainMenu.text(user.first_name);

    bot.sendMessage(chatId, welcomeText, mainMenu.options(user.id));

  } catch (error) {
    console.error('Error in handleStart:', error);
    bot.sendMessage(chatId, 'خطایی در پردازش درخواست شما رخ داد.');
  }
}

module.exports = { handleStart };