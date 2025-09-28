const User = require('../db/User');
const { generateProgressBar } = require('../utils/progressBar');

async function handleBackpackMenu(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;

  try {
    const user = await User.findByPk(userId);
    if (!user || user.backpackLevel === 0) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'شما کوله پشتی ندارید.',
        show_alert: true,
      });
      return;
    }

    const capacity = 50 + (user.backpackLevel - 1) * 25; // 50, 75, 100
    const content = user.backpackContent ? JSON.parse(user.backpackContent) : [];
    const usedSpace = content.reduce((acc, item) => acc + item.quantity, 0);
    const capacityBar = generateProgressBar(usedSpace, capacity);
    const fuelBar = generateProgressBar(user.fuel, 5);

    let contentText = '**محتویات کوله پشتی:**\n';
    if (content.length > 0) {
      contentText += content
        .map((item) => `- ${item.name} (تعداد: ${item.quantity})`)
        .join('\n');
    } else {
      contentText += 'کوله پشتی شما خالی است.';
    }

    const text = `**🎒 کوله پشتی شما (سطح ${user.backpackLevel})**\n\n- **ظرفیت:**\n${capacityBar}\n- **موجودی سوخت:**\n${fuelBar}\n\n${contentText}`;

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }],
        ],
      },
    });
  } catch (error) {
    console.error('Error in handleBackpackMenu:', error);
  }
}

module.exports = { handleBackpackMenu };
