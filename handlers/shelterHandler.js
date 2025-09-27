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
      const text = `🏕️ **پناهگاه شما**\n\nشما در حال حاضر عضو پناهگاه «**${user.Shelter.name}**» هستید.\n\n- **استان:** ${user.Shelter.province}\n- **شهر:** ${user.Shelter.city}`;
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
      const safeUsername = bot.botUsername.replace(/_/g, '\\_');
      const text = `🏕️ **شما پناهگاهی ندارید!**\n\nبرای پیوستن به یک پناهگاه یا ساختن یکی جدید، مراحل زیر را دنبال کنید:\n\n1.  ربات (@${safeUsername}) را به گروه مورد نظر خود اضافه کنید.\n2.  در گروه، دستور /shelter را ارسال کنید.\n\n- اگر پناهگاهی در آن گروه ثبت نشده باشد، فرآیند ساخت پناهگاه برای شما (در صورتی که ادمین باشید) آغاز می‌شود.\n- اگر پناهگاه از قبل وجود داشته باشد، اطلاعات آن به همراه دکمه «پیوستن به پناهگاه» نمایش داده می‌شود.`;
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

module.exports = { handleManageShelter, handleLeaveShelterConfirm, handleLeaveShelterDo };
