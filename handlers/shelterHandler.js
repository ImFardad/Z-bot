const User = require('../db/User');
const Shelter = require('../db/Shelter');
const UserPossibleShelter = require('../db/UserPossibleShelter');

async function handleManageShelter(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id;

  try {
    const user = await User.findByPk(userId, { include: Shelter });

    if (!user) {
      bot.answerCallbackQuery(callbackQuery.id, { text: 'خطا: کاربر پیدا نشد.', show_alert: true });
      return;
    }

    // --- Case 1: User is already in a shelter ---
    if (user.shelterId && user.Shelter) {
      const text = `🏕️ **پناهگاه شما**\n\nشما در حال حاضر عضو پناهگاه «**${user.Shelter.name}**» هستید.`;
      const options = {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚪 خروج از پناهگاه', callback_data: 'shelter_leave_confirm' }],
            [{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]
          ]
        }
      };
      bot.editMessageText(text, options);
      return;
    }

    // --- Case 2: User is not in a shelter, find possible shelters ---
    const userWithPossibleShelters = await User.findByPk(userId, {
      include: {
        model: Shelter,
        as: 'PossibleShelters',
      },
    });

    const possibleShelters = userWithPossibleShelters.PossibleShelters;

    // --- Case 2a: User has possible shelters to join ---
    if (possibleShelters && possibleShelters.length > 0) {
      const text = 'شما هنوز به هیچ پناهگاهی ملحق نشده‌اید.\n\nلیست پناهگاه‌هایی که می‌توانید به آن‌ها ملحق شوید (گروه‌هایی که در آن‌ها ربات را استارت کرده‌اید):';
      
      const keyboard = possibleShelters.map(shelter => {
        return [{ text: shelter.name, callback_data: `shelter_join:${shelter.id}` }];
      });

      keyboard.push(
        [{ text: '🔄 رفرش', callback_data: 'action:manage_shelter' }],
        [{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]
      );

      const options = {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: keyboard,
        }
      };
      bot.editMessageText(text, options);
      return;
    }

    // --- Case 2b: User has no possible shelters ---
    // Escape underscores for Markdown
    const safeUsername = bot.botUsername.replace(/_/g, '\\_');

    const text = `🏕️ **شما پناهگاهی ندارید!**\n\nیک بازمانده تنها هستید. برای پیوستن به یک پناهگاه یا ساختن یکی جدید، مراحل زیر را دنبال کنید:\n\n1.  یک گروه در تلگرام بسازید.\n2.  این ربات (@${safeUsername}) را به گروه خود اضافه کنید.\n3.  دستور /start را در گروه ارسال کنید.\n\nپس از این کار، آن گروه به عنوان یک پناهگاه ثبت شده و در این منو برای شما قابل انتخاب خواهد بود.`;
    
    const options = {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 رفرش', callback_data: 'action:manage_shelter' }, { text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]
        ]
      }
    };
    bot.editMessageText(text, options);

  } catch (error) {
    // Ignore "message is not modified" error, which happens on refresh when nothing has changed.
    if (error.response && error.response.body && error.response.body.description.includes('message is not modified')) {
      // Silently answer the callback query to remove the "loading" state on the button
      bot.answerCallbackQuery(callbackQuery.id);
    } else {
      // For all other errors, log them and notify the user.
      console.error('Error in handleManageShelter:', error);
      bot.answerCallbackQuery(callbackQuery.id, { text: 'خطایی در مدیریت پناهگاه رخ داد.', show_alert: true });
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
      bot.answerCallbackQuery(callbackQuery.id, { text: 'خطا: این پناهگاه دیگر وجود ندارد.', show_alert: true });
      return;
    }

    // Update the user's shelterId
    await User.update({ shelterId: shelterId }, { where: { id: userId } });

    // Send notification to the shelter group
    const userName = callbackQuery.from.first_name;
    bot.sendMessage(shelterId, `🏕️ یک بازمانده جدید به شما پیوست!\n\n«**${userName}**» اکنون عضو این پناهگاه است.`, { parse_mode: 'Markdown' });

    const text = `✅ تبریک!\n\nشما با موفقیت به پناهگاه «**${shelter.name}**» ملحق شدید.`;
    const options = {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]
        ]
      }
    };
    bot.editMessageText(text, options);

  } catch (error) {
    console.error('Error in handleJoinShelter:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'خطایی در عضویت در پناهگاه رخ داد.', show_alert: true });
  }
}

module.exports = { handleManageShelter, handleJoinShelter };

async function handleLeaveShelterConfirm(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const userId = callbackQuery.from.id;

  try {
    const user = await User.findByPk(userId, { include: Shelter });
    if (!user || !user.Shelter) {
      bot.answerCallbackQuery(callbackQuery.id, { text: 'شما در حال حاضر عضو هیچ پناهگاهی نیستید.', show_alert: true });
      return;
    }

    const text = `⚠️ **آیا مطمئن هستید؟**\n\nآیا می‌خواهید پناهگاه «**${user.Shelter.name}**» را ترک کنید؟`;
    const options = {
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
    };
    bot.editMessageText(text, options);
  } catch (error) {
    console.error('Error in handleLeaveShelterConfirm:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'خطایی در فرآیند خروج رخ داد.', show_alert: true });
  }
}

async function handleLeaveShelterDo(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const userId = callbackQuery.from.id;

  try {
    // Set shelterId to null
    await User.update({ shelterId: null }, { where: { id: userId } });

    const text = 'شما با موفقیت از پناهگاه خود خارج شدید.';
    const options = {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 رفرش', callback_data: 'action:manage_shelter' }, { text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]
        ]
      }
    };
    bot.editMessageText(text, options);
  } catch (error) {
    console.error('Error in handleLeaveShelterDo:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'خطایی در فرآیند خروج رخ داد.', show_alert: true });
  }
}

module.exports = { handleManageShelter, handleJoinShelter, handleLeaveShelterConfirm, handleLeaveShelterDo };

async function handleListShelterMembers(bot, msg) {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;

  // This command should only work in groups
  if (chatType !== 'group' && chatType !== 'supergroup') {
    bot.sendMessage(chatId, 'این دستور فقط در گروه‌ها قابل استفاده است.');
    return;
  }

  try {
    // Check if the group is a registered shelter
    const shelter = await Shelter.findByPk(chatId);
    if (!shelter) {
      bot.sendMessage(chatId, 'این گروه به عنوان پناهگاه ثبت نشده است. لطفاً ابتدا از دستور /start استفاده کنید.');
      return;
    }

    // Find all users in this shelter
    const members = await User.findAll({
      where: { shelterId: chatId },
      attributes: ['firstName', 'lastName'],
    });

    if (members.length === 0) {
      bot.sendMessage(chatId, 'هیچ عضوی در این پناهگاه یافت نشد.');
      return;
    }

    // Format the list of members
    let memberList = `👥 **اعضای پناهگاه «${shelter.name}»:**\n\n`;
    members.forEach((member, index) => {
      const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ');
      memberList += `${index + 1}. ${fullName}\n`;
    });

    bot.sendMessage(chatId, memberList, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Error in handleListShelterMembers:', error);
    bot.sendMessage(chatId, 'خطایی در دریافت لیست اعضا رخ داد.');
  }
}

module.exports = { handleManageShelter, handleJoinShelter, handleLeaveShelterConfirm, handleLeaveShelterDo, handleListShelterMembers };
