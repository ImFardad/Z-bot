const geminiService = require('../services/geminiService');
const User = require('../db/User');
const { activeMenuMessages } = require('./startHandler');

// Simple in-memory state for the zombie scenario
const userZombieState = {};

async function startZombieScenario(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id;

  try {
    // Check if the user already has an active scenario
    if (userZombieState[chatId] && userZombieState[chatId].scenario) {
      const existingScenario = userZombieState[chatId].scenario;
      await bot.sendMessage(chatId, '⚠️ **سناریوی فعال**\n\nشما یک سناریوی پاسخ‌داده‌نشده دارید. لطفاً ابتدا راه حل خود را برای آن ارسال کنید.', { parse_mode: 'Markdown' });
      const reminderText = `**🧟 یادآوری سناریو**\n\n---\n\n${existingScenario}\n\n---\n\nایده و راه حل خود را برای نجات پیدا کردن از این موقعیت بنویسید و در همین چت ارسال کنید.`;
      await bot.sendMessage(chatId, reminderText, { parse_mode: 'Markdown' });
      return;
    }

    if (!geminiService.isEnabled()) {
      const errorText = '⚠️ **سرویس غیرفعال**\n\nمتاسفانه سرویس هوش مصنوعی در حال حاضر در دسترس نیست. لطفاً ساعاتی دیگر دوباره تلاش کنید.';
      await bot.editMessageText(errorText, { 
        chat_id: chatId, 
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]] } 
      });
      return;
    }

    await bot.editMessageText('⏳ در حال تولید سناریوی جدید... لطفاً کمی صبر کنید.', {
      chat_id: chatId,
      message_id: messageId,
    });

    const scenario = await geminiService.generateZombieScenario(userId);

    if (scenario) {
      userZombieState[chatId] = { scenario: scenario, type: 'zombie' };
      const scenarioText = `**🧟 سناریوی جدید**\n\n---\n\n${scenario}\n\n---\n\nایده و راه حل خود را برای نجات پیدا کردن از این موقعیت بنویسید و در همین چت ارسال کنید.`;
      await bot.editMessageText(scenarioText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
      });
    } else {
      const errorText = '⚠️ **خطای سرویس**\n\nمتاسفانه در حال حاضر امکان تولید سناریوی جدید وجود ندارد (ممکن است سهمیه روزانه به پایان رسیده باشد). لطفاً ساعاتی دیگر دوباره تلاش کنید.';
      await bot.editMessageText(errorText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]] }
      });
    }
  } catch (error) {
    console.error("Error in startZombieScenario:", error);
    try {
      const errorText = '❌ **خطا**\n\nمشکلی در شروع سناریو رخ داد. لطفاً دوباره تلاش کنید.';
      await bot.editMessageText(errorText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]] }
      });
    } catch (e) {
      console.error("Failed to send error message in startZombieScenario:", e);
    }
  }
}

async function handleZombieSolution(bot, msg) {
  const chatId = msg.chat.id;
  const state = userZombieState[chatId];

  if (!state || !state.scenario) {
    return false; // Not a zombie solution
  }

  try {
    const userAnswer = msg.text;
    const scenario = state.scenario;

    delete userZombieState[chatId];

    await bot.sendMessage(chatId, '🧠 در حال تحلیل راه حل شما... این فرآیند ممکن است کمی طول بکشد.');

    const evaluation = await geminiService.evaluateZombieSolution(scenario, userAnswer);

    let resultText;
    if (evaluation && typeof evaluation === 'object') {
      try {
        const user = await User.findByPk(msg.from.id);
        if (user) {
          const scores = [
            evaluation.practicality,
            evaluation.creativity,
            evaluation.efficiency,
            evaluation.speed,
            evaluation.risk_assessment
          ];
          const scenarioAverage = scores.reduce((a, b) => a + b, 0) / scores.length;
          
          const oldSurvivalPercentage = user.survivalPercentage || 0;
          const newSurvivalPercentage = (oldSurvivalPercentage + scenarioAverage) / 2;
          
          user.survivalPercentage = newSurvivalPercentage;
          await user.save();

          resultText = `**📊 تحلیل و امتیازات**\n\n` +
          `👍 **کاربردی بودن:** ${evaluation.practicality}%\n` +
          `💡 **خلاقیت:** ${evaluation.creativity}%\n` +
          `⚙️ **کارآمدی:** ${evaluation.efficiency}%\n` +
          `⏱️ **سرعت عمل:** ${evaluation.speed}%\n` +
          `⚠️ **مدیریت ریسک:** ${evaluation.risk_assessment}%\n\n` +
          `---\n\n` +
          `📝 **بازخورد کلی:**\n${evaluation.feedback}\n\n` +
          `---\n\n` +
          `⭐ **امتیاز این مرحله:** ${scenarioAverage.toFixed(2)}%\n` +
          `🧟 **مجموع احتمال بقا:** ${newSurvivalPercentage.toFixed(2)}%`;

        } else {
          resultText = '❌ **خطای داخلی**\n\nاطلاعات بازمانده یافت نشد. لطفاً دوباره تلاش کنید.';
        }
      } catch (error) {
        console.error('Failed to process zombie solution:', error);
        resultText = '❌ **خطا**\n\nمشکلی در پردازش پاسخ شما رخ داد. لطفاً دوباره تلاش کنید.';
      }
    } else {
      resultText = '⚠️ **خطای سرویس**\n\nمتاسفانه در حال حاضر امکان ارزیابی پاسخ شما وجود ندارد (ممکن است سهمیه روزانه به پایان رسیده باشد). لطفاً ساعاتی دیگر دوباره تلاش کنید.';
    }

    const sentMessage = await bot.sendMessage(chatId, resultText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]
        ]
      }
    });
    // Update the active menu to be this new message
    activeMenuMessages[chatId] = sentMessage.message_id;
    
    return true; // Message was handled
  } catch (error) {
    console.error("Error in handleZombieSolution:", error);
    try {
      const errorText = '❌ **خطای پیش‌بینی نشده**\n\nیک خطای غیرمنتظره در پردازش پاسخ شما رخ داد. لطفاً دوباره تلاش کنید.';
      await bot.sendMessage(chatId, errorText, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error("Failed to send error message in handleZombieSolution:", e);
    }
    return true; // Still handled, just with an error
  }
}

module.exports = { startZombieScenario, handleZombieSolution, userZombieState };