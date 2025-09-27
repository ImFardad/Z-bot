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

    if (user && user.Shelter) {
      const text = `**🏕️ پناهگاه فعلی شما**\n\nشما عضو پناهگاه «**${user.Shelter.name}**» هستید.\n\n**اطلاعات پناهگاه:**\n- استان: ${user.Shelter.province}\n- شهر: ${user.Shelter.city}`;
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
      const text = `**🏕️ شما در هیچ پناهگاهی عضو نیستید!**\n\nبرای ساختن یک پناهگاه جدید یا پیوستن به یکی از پناهگاه‌های موجود، لطفاً طبق راهنمای زیر عمل کنید:\n\n**۱. ساخت پناهگاه جدید**\n- ربات را به گروه مورد نظر خود اضافه کنید.\n- در گروه، دستور /shelter را تایپ کنید.\n- *توجه: فقط ادمین‌های گروه می‌توانند پناهگاه جدید بسازند.*\n\n**۲. پیوستن به پناهگاه موجود**\n- در گروهی که پناهگاه در آن قرار دارد، دستور /shelter را تایپ کنید.\n- از طریق دکمه «پیوستن به پناهگاه» که نمایش داده می‌شود، عضو شوید.`;
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]
          ]
        }
      });
    }
  } catch (error) {
    if (error.response && error.response.body && error.response.body.description.includes('message is not modified')) {
      // Silently ignore.
    } else {
      console.error('Error in handleManageShelter:', error);
    }
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

    const text = `**⚠️ تایید خروج**\n\nآیا برای ترک پناهگاه «**${user.Shelter.name}**» مطمئن هستید؟`;
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
    // First, find the user to get their current shelter ID and name
    const user = await User.findByPk(userId);
    if (!user || !user.shelterId) {
      // User is not in a shelter, nothing to do.
      // This case should ideally not be reached if the menus are correct.
      console.error(`User ${userId} tried to execute leave action but was not in a shelter.`);
      return;
    }

    const oldShelterId = user.shelterId;
    const userName = [user.firstName, user.lastName].filter(Boolean).join(' ');

    // Now, update the user to remove them from the shelter
    await User.update({ shelterId: null }, { where: { id: userId } });

    // Send notification to the old shelter
    try {
      const notificationText = `➖ **یک بازمانده پناهگاه را ترک کرد!**\n\nکاربر «${userName}» دیگر عضو این پناهگاه نیست.`;
      await bot.sendMessage(oldShelterId, notificationText, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error(`Failed to send leave notification to shelter ${oldShelterId}:`, e.message);
    }

    // Update the message in the private chat
    const text = '✅ **خروج موفق**\n\nشما با موفقیت از پناهگاه خود خارج شدید.';
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
    // Inform user about the error
    try {
        const errorText = '❌ **خطا**\n\nمشکلی در فرآیند خروج از پناهگاه رخ داد. لطفاً دوباره تلاش کنید.';
        await bot.editMessageText(errorText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]]
            }
        });
    } catch (e) {
        console.error('Failed to send error message on leave failure:', e);
    }
  }
}

module.exports = { handleManageShelter, handleLeaveShelterConfirm, handleLeaveShelterDo };
