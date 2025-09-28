const User = require('../db/User');
const ShopItem = require('../db/ShopItem');

async function handleShopMenu(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id;

  try {
    const user = await User.findByPk(userId);
    const items = await ShopItem.findAll();

    let text = '**🛒 فروشگاه**\n\nموجودی سکه شما: **' + user.coins + '** 🪙\n\n---\n\n'
    const keyboard = [];

    const backpackLevel1 = items.find(i => i.type === 'backpack' && i.level === 1);
    const backpackLevel2 = items.find(i => i.type === 'backpack_upgrade' && i.level === 2);
    const backpackLevel3 = items.find(i => i.type === 'backpack_upgrade' && i.level === 3);

    if (user.backpackLevel === 0 && backpackLevel1) {
        text += `**${backpackLevel1.name}**\n*${backpackLevel1.description}*\n- قیمت: ${backpackLevel1.price} سکه\n\n`;
        keyboard.push([
          { text: `خرید ${backpackLevel1.name}`, callback_data: `shop:buy:${backpackLevel1.id}` },
        ]);
    } else if (user.backpackLevel === 1 && backpackLevel2) {
        text += `**${backpackLevel2.name}**\n*${backpackLevel2.description}*\n- قیمت: ${backpackLevel2.price} سکه\n\n`;
        keyboard.push([{ text: backpackLevel2.name, callback_data: `shop:buy:${backpackLevel2.id}` }]);
    } else if (user.backpackLevel === 2 && backpackLevel3) {
        text += `**${backpackLevel3.name}**\n*${backpackLevel3.description}*\n- قیمت: ${backpackLevel3.price} سکه\n\n`;
        keyboard.push([{ text: backpackLevel3.name, callback_data: `shop:buy:${backpackLevel3.id}` }]);
    } else if (user.backpackLevel >= 3) {
        text += 'شما در حال حاضر بهترین کوله پشتی را دارید!\n';
    }

    if (keyboard.length === 0 && user.backpackLevel < 3) {
        text += 'در حال حاضر آیتمی برای خرید وجود ندارد.';
    }

    keyboard.push([{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]);

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });

  } catch (error) {
    console.error('Error in handleShopMenu:', error);
    await bot.sendMessage(chatId, '❌ مشکلی در باز کردن فروشگاه پیش آمد.');
  }
}

async function handleShopBuyCallback(bot, callbackQuery) {
  const userId = callbackQuery.from.id;
  const itemId = callbackQuery.data.split(':')[2];

  try {
    const user = await User.findByPk(userId);
    const item = await ShopItem.findByPk(itemId);

    if (!item) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ این آیتم دیگر موجود نیست.',
        show_alert: true,
      });
      return;
    }

    if (user.coins < item.price) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: '🪙 سکه شما برای خرید این آیتم کافی نیست.',
        show_alert: true,
      });
      return;
    }

    // Specific logic for backpacks
    if (item.type === 'backpack' || item.type === 'backpack_upgrade') {
      if (user.backpackLevel !== item.level - 1) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: '⚠️ شما شرایط لازم برای خرید این سطح از کوله پشتی را ندارید.',
          show_alert: true,
        });
        return;
      }
      user.backpackLevel = item.level;
    }

    user.coins -= item.price;
    await user.save();

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: `✅ خرید «${item.name}» با موفقیت انجام شد.`,
    });

    // Refresh the shop menu
    await handleShopMenu(bot, callbackQuery);

  } catch (error) {
    console.error('Error in handleShopBuyCallback:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ خطایی در فرآیند خرید رخ داد.',
      show_alert: true,
    });
  }
}

module.exports = { handleShopMenu, handleShopBuyCallback };