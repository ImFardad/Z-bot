const User = require('../db/User');
const Shelter = require('../db/Shelter');
const UserPossibleShelter = require('../db/UserPossibleShelter');

// Note: All `answerCallbackQuery` calls have been removed from this file.
// The main `handleMenuCallback` is now responsible for answering the query once at the beginning.

async function handleManageShelter(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id;

  try {
    const user = await User.findByPk(userId, { include: Shelter });

    if (!user) {
      console.error(`User not found in handleManageShelter: ${userId}`);
      return;
    }

    if (user.shelterId && user.Shelter) {
      const text = `🏕️ **پناهگاه شما**\n\nشما در حال حاضر عضو پناهگاه «**${user.Shelter.name}**» هستید.`;
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚪 خروج از پناهگاه', callback_data: 'shelter_leave_confirm' }],
            [{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]
          ]
        }
      });
    } else {
      const userWithPossibleShelters = await User.findByPk(userId, {
        include: { model: Shelter, as: 'PossibleShelters' },
      });
      const possibleShelters = userWithPossibleShelters.PossibleShelters;

      if (possibleShelters && possibleShelters.length > 0) {
        const text = 'شما هنوز به هیچ پناهگاهی ملحق نشده‌اید.\n\nلیست پناهگاه‌هایی که می‌توانید به آن‌ها ملحق شوید (گروه‌هایی که در آن‌ها ربات را استارت کرده‌اید):';
        const keyboard = possibleShelters.map(shelter => ([{ text: shelter.name, callback_data: `shelter_join:${shelter.id}` }]));
        keyboard.push(
          [{ text: '🔄 رفرش', callback_data: 'action:manage_shelter' }],
          [{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]
        );
        await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: keyboard } });
      } else {
        const safeUsername = bot.botUsername.replace(/_/g, '\\_');
        const text = `🏕️ **شما پناهگاهی ندارید!**\n\nیک بازمانده تنها هستید. برای پیوستن به یک پناهگاه یا ساختن یکی جدید، مراحل زیر را دنبال کنید:\n\n1.  یک گروه در تلگرام بسازید.\n2.  این ربات (@${safeUsername}) را به گروه خود اضافه کنید.\n3.  دستور /start را در گروه ارسال کنید.\n\nپس از این کار، آن گروه به عنوان یک پناهگاه ثبت شده و در این منو برای شما قابل انتخاب خواهد بود.`;
        await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔄 رفرش', callback_data: 'action:manage_shelter' }, { text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]] } });
      }
    }
  } catch (error) {
    if (error.response && error.response.body && error.response.body.description.includes('message is not modified')) {
      // Silently ignore. The main handler already answered the query.
    } else {
      console.error('Error in handleManageShelter:', error);
    }
  }
}

async function handleJoinShelter(bot, callbackQuery, shelterId) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id;

  try {
    const shelter = await Shelter.findByPk(shelterId);
    if (!shelter) {
      console.error(`Shelter not found for join: ${shelterId}`);
      return;
    }

    await User.update({ shelterId: shelterId }, { where: { id: userId } });

    const userName = callbackQuery.from.first_name;
    await bot.sendMessage(shelterId, `🏕️ یک بازمانده جدید به شما پیوست!\n\n«**${userName}**» اکنون عضو این پناهگاه است.`, { parse_mode: 'Markdown' });

    const text = `✅ تبریک!\n\nشما با موفقیت به پناهگاه «**${shelter.name}**» ملحق شدید.`;
    await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]] } });
  } catch (error) {
    console.error('Error in handleJoinShelter:', error);
  }
}

async function handleLeaveShelterConfirm(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const userId = callbackQuery.from.id;

  try {
    const user = await User.findByPk(userId, { include: Shelter });
    if (!user || !user.Shelter) {
      console.error(`User ${userId} tried to leave a shelter but is not in one.`);
      return;
    }

    const text = `⚠️ **آیا مطمئن هستید؟**\n\nآیا می‌خواهید پناهگاه «**${user.Shelter.name}**» را ترک کنید؟`;
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '❌ خیر', callback_data: 'action:manage_shelter' },
            { text: '✅ بله، خارج شو', callback_data: 'shelter_leave_do' }
          ]
        ]
      }
    });
  } catch (error) {
    console.error('Error in handleLeaveShelterConfirm:', error);
  }
}

async function handleLeaveShelterDo(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const userId = callbackQuery.from.id;

  try {
    await User.update({ shelterId: null }, { where: { id: userId } });

    const text = 'شما با موفقیت از پناهگاه خود خارج شدید.';
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 رفرش', callback_data: 'action:manage_shelter' }, { text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]
        ]
      }
    });
  } catch (error) {
    console.error('Error in handleLeaveShelterDo:', error);
  }
}

async function handleListShelterMembers(bot, msg) {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;

  if (chatType !== 'group' && chatType !== 'supergroup') {
    try { await bot.sendMessage(chatId, 'این دستور فقط در گروه‌ها قابل استفاده است.'); } catch(e) { console.error(e); }
    return;
  }

  try {
    const shelter = await Shelter.findByPk(chatId);
    if (!shelter) {
      await bot.sendMessage(chatId, 'این گروه به عنوان پناهگاه ثبت نشده است. لطفاً ابتدا از دستور /start استفاده کنید.');
      return;
    }

    const members = await User.findAll({
      where: { shelterId: chatId },
      attributes: ['firstName', 'lastName'],
    });

    if (members.length === 0) {
      await bot.sendMessage(chatId, 'هیچ عضوی در این پناهگاه یافت نشد.');
      return;
    }

    let memberList = `👥 **اعضای پناهگاه «${shelter.name}»:**\n\n`;
    members.forEach((member, index) => {
      const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ');
      memberList += `${index + 1}. ${fullName}\n`;
    });

    await bot.sendMessage(chatId, memberList, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Error in handleListShelterMembers:', error);
    try { await bot.sendMessage(chatId, 'خطایی در دریافت لیست اعضا رخ داد.'); } catch(e) { console.error(e); }
  }
}

module.exports = { handleManageShelter, handleJoinShelter, handleLeaveShelterConfirm, handleLeaveShelterDo, handleListShelterMembers };
