const geminiService = require('../services/geminiService');
const UserQuestionHistory = require('../db/UserQuestionHistory');
const User = require('../db/User');

// Simple in-memory state for the zombie scenario
const userZombieState = {};

async function startZombieScenario(bot, chatId, userId) {
  // Check if the user already has an active scenario
  if (userZombieState[chatId] && userZombieState[chatId].scenario) {
    const existingScenario = userZombieState[chatId].scenario;
    bot.sendMessage(chatId, 'شما یک سناریوی فعال و پاسخ‌داده‌نشده دارید. لطفاً ابتدا به آن پاسخ دهید.');
    bot.sendMessage(chatId, `🧟 **یادآوری سناریو:**\n\n\n${existingScenario}\n\n\nایده و راه حل خود را برای نجات پیدا کردن از این موقعیت بنویسید و ارسال کنید.`, { parse_mode: 'Markdown' });
    return;
  }

  if (!geminiService.isEnabled) {
    bot.sendMessage(chatId, 'متاسفانه این بخش در حال حاضر غیرفعال است. لطفاً بعداً تلاش کنید.');
    return;
  }

  bot.sendMessage(chatId, '⏳ در حال ساخت یک سناریوی آخرالزمانی...');

  const scenario = await geminiService.generateZombieScenario(userId);

  if (scenario) {
    // Store the scenario in the user's state
    userZombieState[chatId] = { scenario: scenario, type: 'zombie' };
    
    // Save the scenario to the history
    try {
      await UserQuestionHistory.create({
        question: scenario, // Using 'question' field to store the scenario
        userId: userId,
        type: 'zombie',
      });
    } catch (error) {
      console.error('Failed to save scenario to history:', error);
    }

    bot.sendMessage(chatId, `🧟 **سناریوی جدید:**\n\n\n${scenario}\n\n\nایده و راه حل خود را برای نجات پیدا کردن از این موقعیت بنویسید و ارسال کنید.`, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, 'خطایی در تولید سناریو رخ داد. لطفاً دوباره تلاش کنید.');
  }
}

async function handleZombieSolution(bot, msg) {
  const chatId = msg.chat.id;
  const state = userZombieState[chatId];

  // Check if the user was expecting to answer a scenario
  if (state && state.scenario) {
    const userAnswer = msg.text;
    const scenario = state.scenario;

    // Clear state immediately
    delete userZombieState[chatId];

    bot.sendMessage(chatId, '🧠 در حال تحلیل و امتیازدهی به راه حل شما...');

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
          resultText += `👍 کاربردی بودن: ${evaluation.practicality}%
`;
          resultText += `💡 خلاقیت: ${evaluation.creativity}%
`;
          resultText += `⚙️ کارآمدی: ${evaluation.efficiency}%
`;
          resultText += `⏱️ سرعت عمل: ${evaluation.speed}%
`;
          resultText += `⚠️ مدیریت ریسک: ${evaluation.risk_assessment}%

`;
          resultText += `📝 **بازخورد:** ${evaluation.feedback}

`;
          resultText += `⭐ **امتیاز این مرحله:** ${scenarioAverage.toFixed(2)}%
`;
          resultText += `🧟 **درصد کلی بقا:** ${newSurvivalPercentage.toFixed(2)}%`;

        } else {
          resultText = 'خطا: کاربر پیدا نشد.';
        }
      } catch (error) {
        console.error('Failed to process zombie solution:', error);
        resultText = 'خطایی در پردازش پاسخ شما رخ داد.';
      }
    } else {
      resultText = 'خطایی در ارزیابی پاسخ شما توسط هوش مصنوعی رخ داد. لطفاً دوباره تلاش کنید.';
    }

    // Send the result in a new message with a back button
    await bot.sendMessage(chatId, resultText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '➡️ بازگشت به منوی اصلی', callback_data: 'navigate:main' }]
        ]
      }
    });
    
    return true; // Message was handled
  }

  return false; // Message was not a zombie solution
}

module.exports = { startZombieScenario, handleZombieSolution, userZombieState };
