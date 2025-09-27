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
      await bot.sendMessage(chatId, 'شما یک سناریوی فعال و پاسخ‌داده‌نشده دارید. لطفاً ابتدا به آن پاسخ دهید.');
      await bot.sendMessage(chatId, `🧟 **یادآوری سناریو:**\n\n\n${existingScenario}\n\n\nایده و راه حل خود را برای نجات پیدا کردن از این موقعیت بنویسید و ارسال کنید.`, { parse_mode: 'Markdown' });
      return;
    }

    if (!geminiService.isEnabled()) {
      await bot.editMessageText('متاسفانه سرویس هوش مصنوعی در حال حاضر غیرفعال است. لطفاً بعداً تلاش کنید.', { 
        chat_id: chatId, 
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]] } 
      });
      return;
    }

    await bot.editMessageText('⏳ در حال ساخت یک سناریوی آخرالزمانی...', {
      chat_id: chatId,
      message_id: messageId,
    });

    const scenario = await geminiService.generateZombieScenario(userId);

    if (scenario) {
      userZombieState[chatId] = { scenario: scenario, type: 'zombie' };
      await bot.editMessageText(`🧟 **سناریوی جدید:**\n\n\n${scenario}\n\n\nایده و راه حل خود را برای نجات پیدا کردن از این موقعیت بنویسید و ارسال کنید.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
      });
    } else {
      await bot.editMessageText('متاسفانه سهمیه تولید سناریو برای امروز به پایان رسیده است یا خطایی در ارتباط با سرویس رخ داده. لطفاً بعداً تلاش کنید.', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]] }
      });
    }
  } catch (error) {
    console.error("Error in startZombieScenario:", error);
    try {
      await bot.editMessageText('خطایی در شروع سناریو رخ داد. لطفاً دوباره تلاش کنید.', {
        chat_id: chatId,
        message_id: messageId,
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

    await bot.sendMessage(chatId, '🧠 در حال تحلیل و امتیازدهی به راه حل شما...');

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

          resultText = `**تحلیل راه حل شما:**\n\n`;
          resultText += `👍 کاربردی بودن: ${evaluation.practicality}%\n`;
          resultText += `💡 خلاقیت: ${evaluation.creativity}%\n`;
          resultText += `⚙️ کارآمدی: ${evaluation.efficiency}%\n`;
          resultText += `⏱️ سرعت عمل: ${evaluation.speed}%\n`;
          resultText += `⚠️ مدیریت ریسک: ${evaluation.risk_assessment}%\n\n`;
          resultText += `📝 **بازخورد:** ${evaluation.feedback}\n\n`;
          resultText += `⭐ **امتیاز این مرحله:** ${scenarioAverage.toFixed(2)}%\n`;
          resultText += `🧟 **درصد کلی بقا:** ${newSurvivalPercentage.toFixed(2)}%`;

        } else {
          resultText = 'خطا: کاربر پیدا نشد.';
        }
      } catch (error) {
        console.error('Failed to process zombie solution:', error);
        resultText = 'خطایی در پردازش پاسخ شما رخ داد.';
      }
    } else {
      resultText = 'متاسفانه سهمیه ارزیابی پاسخ‌ها برای امروز به پایان رسیده است یا خطایی در ارتباط با سرویس رخ داده. لطفاً بعداً تلاش کنید.';
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
      await bot.sendMessage(chatId, 'خطایی پیش‌بینی نشده در پردازش پاسخ شما رخ داد.');
    } catch (e) {
      console.error("Failed to send error message in handleZombieSolution:", e);
    }
    return true; // Still handled, just with an error
  }
}

module.exports = { startZombieScenario, handleZombieSolution, userZombieState };