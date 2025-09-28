const { Op } = require('sequelize');
const User = require('../db/User');
const ShopItem = require('../db/ShopItem');
const DailyPurchase = require('../db/DailyPurchase');

// Helper to get the start of the current day in UTC
function getStartOfDayUTC() {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return now;
}

async function handleShopMenu(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id;

  try {
    const user = await User.findByPk(userId);
    const allItems = await ShopItem.findAll();
    const todayPurchases = await DailyPurchase.findAll({
      where: {
        userId,
        purchaseDate: {
          [Op.gte]: getStartOfDayUTC(),
        },
      },
    });

    let text = `**🛒 فروشگاه**\n\nموجودی سکه شما: **${user.coins}** 🪙\n\n---\n`;
    const keyboard = [];

    if (user.backpackLevel === 0) {
      text += '**برای خرید آیتم‌های دیگر، ابتدا باید یک کوله پشتی بخرید.**\n\n';
      const backpackLevel1 = allItems.find((i) => i.type === 'backpack' && i.level === 1);
      if (backpackLevel1) {
        text += `**${backpackLevel1.name}**\n*${backpackLevel1.description}*\n- قیمت: ${backpackLevel1.price} سکه\n`;
        keyboard.push([
          { text: `خرید ${backpackLevel1.name}`, callback_data: `shop:buy:${backpackLevel1.id}` },
        ]);
      } else {
        text += 'فعلاً آیتمی برای خرید در فروشگاه موجود نیست.';
      }
    } else {
      // --- Backpack Upgrade Section ---
      text += '\n**🎒 ارتقای کوله پشتی**\n';
      const backpackLevel2 = allItems.find((i) => i.type === 'backpack_upgrade' && i.level === 2);
      const backpackLevel3 = allItems.find((i) => i.type === 'backpack_upgrade' && i.level === 3);

      if (user.backpackLevel === 1 && backpackLevel2) {
        text += `*${backpackLevel2.description}*\n- قیمت: ${backpackLevel2.price} سکه\n`;
        keyboard.push([
          { text: backpackLevel2.name, callback_data: `shop:buy:${backpackLevel2.id}` },
        ]);
      } else if (user.backpackLevel === 2 && backpackLevel3) {
        text += `*${backpackLevel3.description}*\n- قیمت: ${backpackLevel3.price} سکه\n`;
        keyboard.push([
          { text: backpackLevel3.name, callback_data: `shop:buy:${backpackLevel3.id}` },
        ]);
      } else {
        text += 'شما در حال حاضر بهترین کوله پشتی را دارید!\n';
      }

      // --- Daily Items Section ---
      text += '\n---\n\n**آیتم‌های روزانه**\n';
      const dailyItems = allItems.filter(i => i.type.startsWith('daily_'));

      for (const item of dailyItems) {
          const purchaseHistory = todayPurchases.filter(p => p.itemType === item.type);
          let limit = 1; // Default limit
          let unit = 'عدد';
          if (item.type === 'daily_fuel') {
              limit = 5;
              unit = 'لیتر';
          }
          const totalPurchased = purchaseHistory.reduce((acc, p) => acc + p.quantity, 0);
          const remaining = limit - totalPurchased;

          text += `\n**${item.name}**\n*${item.description}*\n- قیمت: ${item.price} سکه / هر ${unit}\n`;
          if (remaining > 0) {
              text += `- سهمیه امروز شما: **${remaining} ${unit}**\n`;
              keyboard.push([{ text: `خرید ۱ ${unit} ${item.name}`, callback_data: `shop:buy:${item.id}` }]);
          } else {
              text += '- سهمیه امروز شما تمام شده است.\n';
          }
      }
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
        return bot.answerCallbackQuery(callbackQuery.id, { text: '❌ این آیتم دیگر موجود نیست.', show_alert: true });
      }
  
      if (user.coins < item.price) {
        return bot.answerCallbackQuery(callbackQuery.id, { text: '🪙 سکه شما برای خرید این آیتم کافی نیست.', show_alert: true });
      }
  
      // --- Backpack Logic ---
      if (item.type === 'backpack' || item.type === 'backpack_upgrade') {
        if (user.backpackLevel !== item.level - 1) {
          return bot.answerCallbackQuery(callbackQuery.id, { text: '⚠️ شما شرایط لازم برای خرید این سطح از کوله پشتی را ندارید.', show_alert: true });
        }
        user.backpackLevel = item.level;
      }

      // --- Daily Items Logic ---
      if (item.type.startsWith('daily_')) {
        if (user.backpackLevel === 0) {
          return bot.answerCallbackQuery(callbackQuery.id, {
            text: '🎒 برای خرید آیتم‌های روزانه، ابتدا باید کوله پشتی بخرید.',
            show_alert: true,
          });
        }
        const todayPurchases = await DailyPurchase.findAll({
            where: {
              userId,
              itemType: item.type,
              purchaseDate: { [Op.gte]: getStartOfDayUTC() },
            },
        });
        const totalPurchased = todayPurchases.reduce((acc, p) => acc + p.quantity, 0);
        
        let limit = 1;
        let purchaseQuantity = 1;
        let capacityCost = 0;

        if (item.type === 'daily_fuel') limit = 5;
        if (item.type === 'daily_water') capacityCost = 1;
        if (item.type === 'daily_battery') capacityCost = 1;

        if (totalPurchased >= limit) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: '⚠️ سهمیه امروز شما برای این آیتم تمام شده است.', show_alert: true });
        }

        // Check capacity
        if (item.type === 'daily_fuel') {
            if (user.fuel + purchaseQuantity > 5) {
                return bot.answerCallbackQuery(callbackQuery.id, { text: '⛽️ ظرفیت حمل سوخت شما کافی نیست.', show_alert: true });
            }
        } else if (capacityCost > 0) {
            const backpackCapacity = 50 + (user.backpackLevel - 1) * 25;
            const backpackContent = user.backpackContent ? JSON.parse(user.backpackContent) : [];
            const usedSpace = backpackContent.reduce((acc, i) => acc + (i.quantity * (itemWeights[i.type] || 1)), 0);
            if (usedSpace + capacityCost > backpackCapacity) {
                return bot.answerCallbackQuery(callbackQuery.id, { text: '🎒 ظرفیت کوله پشتی شما کافی نیست.', show_alert: true });
            }
        }

        // All checks passed, process the purchase
        user.coins -= item.price;

        if (item.type === 'daily_fuel') {
            user.fuel += purchaseQuantity;
        } else {
            const backpackContent = user.backpackContent ? JSON.parse(user.backpackContent) : [];
            const existingItem = backpackContent.find(i => i.type === item.type);
            if (existingItem) {
                existingItem.quantity += purchaseQuantity;
            } else {
                backpackContent.push({ type: item.type, name: item.name, quantity: purchaseQuantity });
            }
            user.backpackContent = JSON.stringify(backpackContent);
        }

        await DailyPurchase.create({
            userId,
            itemType: item.type,
            quantity: purchaseQuantity,
            purchaseDate: new Date(),
        });
      }
  
      await user.save();
  
      await bot.answerCallbackQuery(callbackQuery.id, { text: `✅ خرید «${item.name}» با موفقیت انجام شد.` });
  
      // Refresh the shop menu
      await handleShopMenu(bot, callbackQuery);

    } catch (error) {
      console.error('Error in handleShopBuyCallback:', error);
      await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ خطایی در فرآیند خرید رخ داد.', show_alert: true });
    }
}

const itemWeights = {
    daily_water: 1,
    daily_battery: 1,
};

module.exports = { handleShopMenu, handleShopBuyCallback };
