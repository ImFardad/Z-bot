const Shelter = require('../db/Shelter');
const User = require('../db/User');
const { generateProgressBar } = require('../utils/progressBar');

const TANKER_CONFIG = {
  levels: {
    1: { capacity: 50, cost: 0 },
    2: { capacity: 100, cost: 500 },
    3: { capacity: 150, cost: 1000 },
    4: { capacity: 250, cost: 2000 },
  },
};

// In-memory store for donation processes { [chatId_userId]: { promptMessageId } }
const donationState = {};

async function handleManageShelterCommand(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    if (msg.chat.type === 'private') {
      return bot.sendMessage(chatId, 'این دستور فقط در گروه‌های پناهگاه قابل استفاده است.');
    }

    const shelter = await Shelter.findByPk(chatId);
    if (!shelter) {
      return bot.sendMessage(chatId, 'این گروه به عنوان پناهگاه ثبت نشده است. از دستور /shelter برای ساخت پناهگاه استفاده کنید.');
    }

    const user = await User.findByPk(userId);
    if (!user || user.shelterId !== chatId) {
      return bot.sendMessage(chatId, 'شما عضو این پناهگاه نیستید و نمی‌توانید آن را مدیریت کنید.', { reply_to_message_id: msg.message_id });
    }

    const text = `**🛠️ مدیریت پناهگاه «${shelter.name}»**\n\n- **خزانه:** ${shelter.treasury} سکه 🪙`;
    const keyboard = {
      inline_keyboard: [
        [{ text: '💰 خزانه', callback_data: 'shelter_manage:treasury' }],
        [{ text: '⛽️ تانکر سوخت', callback_data: 'shelter_manage:tanker' }],
      ],
    };

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });

  } catch (error) {
    console.error('Error in handleManageShelterCommand:', error);
    await bot.sendMessage(chatId, '❌ خطایی در باز کردن منوی مدیریت رخ داد.');
  }
}

async function handleShelterManagerCallback(bot, callbackQuery) {
    const [action, route] = callbackQuery.data.split(':');
    if (action !== 'shelter_manage') return false;

    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const messageId = callbackQuery.message.message_id;

    const user = await User.findByPk(userId);
    if (!user || user.shelterId !== chatId) {
        return bot.answerCallbackQuery(callbackQuery.id, { text: 'شما عضو این پناهگاه نیستید.', show_alert: true });
    }

    const shelter = await Shelter.findByPk(chatId);

    // --- Treasury Menu ---
    if (route === 'treasury') {
        const text = `**💰 خزانه پناهگاه**\n\n- **موجودی فعلی:** ${shelter.treasury} سکه 🪙\n\nشما می‌توانید مقداری از سکه‌های خود را برای استفاده در آینده به خزانه پناهگاه اهدا کنید.`;
        const keyboard = {
            inline_keyboard: [
                [{ text: '🎁 اهدا به خزانه', callback_data: 'shelter_manage:donate_prompt' }],
                [{ text: '➡️ بازگشت', callback_data: 'shelter_manage:main' }],
            ],
        };
        await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard });
        return true;
    }

    // --- Tanker Menu ---
    if (route === 'tanker') {
        const currentLevelInfo = TANKER_CONFIG.levels[shelter.fuelTankerLevel];
        const tankerBar = generateProgressBar(shelter.fuelTankerContent, currentLevelInfo.capacity);

        let text = `**⛽️ تانکر سوخت پناهگاه (سطح ${shelter.fuelTankerLevel})**\n\nاین تانکر، سوخت مورد نیاز پناهگاه را ذخیره می‌کند.\n\n- **موجودی:**\n${tankerBar}`;
        
        const keyboard = [
            [{ text: '💧 اهدا سوخت', callback_data: 'shelter_manage:donate_fuel_prompt' }],
        ];

        if (shelter.fuelTankerLevel < 4) {
            const nextLevelInfo = TANKER_CONFIG.levels[shelter.fuelTankerLevel + 1];
            text += `\n\n- **هزینه ارتقا به سطح ${shelter.fuelTankerLevel + 1}:** ${nextLevelInfo.cost} سکه`;
            keyboard.push([{ text: `🔼 ارتقا به سطح ${shelter.fuelTankerLevel + 1}`, callback_data: 'shelter_manage:upgrade_tanker_prompt' }]);
        } else {
            text += '\n\nتانکر شما در بالاترین سطح قرار دارد.';
        }
        keyboard.push([{ text: '➡️ بازگشت', callback_data: 'shelter_manage:main' }]);

        await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
        return true;
    }

    // --- Back to Main Shelter Menu ---
    if (route === 'main') {
        const text = `**🛠️ مدیریت پناهگاه «${shelter.name}»**\n\n- **خزانه:** ${shelter.treasury} سکه 🪙`;
        const keyboard = {
            inline_keyboard: [
                [{ text: '💰 خزانه', callback_data: 'shelter_manage:treasury' }],
            ],
        };
        await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard });
        return true;
    }

    // --- Coin Donation Prompt ---
    if (route === 'donate_prompt') {
        const promptText = `**🎁 اهدا به خزانه**\n\nموجودی شما: **${user.coins}** سکه 🪙\n\nلطفاً مبلغ مورد نظر برای اهدا را در پاسخ به همین پیام ارسال کنید.`;
        const promptMessage = await bot.sendMessage(chatId, promptText, { parse_mode: 'Markdown' });
        donationState[`${chatId}_${userId}`] = { type: 'coin', promptMessageId: promptMessage.message_id };
        await bot.answerCallbackQuery(callbackQuery.id);
        return true;
    }

    // --- Fuel Donation Prompt ---
    if (route === 'donate_fuel_prompt') {
        const promptText = `**💧 اهدا سوخت**\n\nموجودی سوخت شما: **${user.fuel}** لیتر\n\nلطفاً مقدار سوختی که می‌خواهید به تانکر پناهگاه اهدا کنید را در پاسخ به همین پیام ارسال کنید.`;
        const promptMessage = await bot.sendMessage(chatId, promptText, { parse_mode: 'Markdown' });
        donationState[`${chatId}_${userId}`] = { type: 'fuel', promptMessageId: promptMessage.message_id };
        await bot.answerCallbackQuery(callbackQuery.id);
        return true;
    }

    // --- Tanker Upgrade Prompt ---
    if (route === 'upgrade_tanker_prompt') {
        if (shelter.fuelTankerLevel >= 4) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: 'تانکر شما در بالاترین سطح است.', show_alert: true });
        }
        const nextLevelInfo = TANKER_CONFIG.levels[shelter.fuelTankerLevel + 1];
        if (shelter.treasury < nextLevelInfo.cost) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: `🪙 سکه خزانه برای ارتقا کافی نیست. (مورد نیاز: ${nextLevelInfo.cost})`, show_alert: true });
        }

        shelter.treasury -= nextLevelInfo.cost;
        shelter.fuelTankerLevel += 1;
        await shelter.save();

        await bot.answerCallbackQuery(callbackQuery.id, { text: `✅ تانکر با موفقیت به سطح ${shelter.fuelTankerLevel} ارتقا یافت!` });
        // Refresh the tanker menu
        const event = { ...callbackQuery, data: 'shelter_manage:tanker' };
        await handleShelterManagerCallback(bot, event);
        return true;
    }

    return false;
}

async function handleDonationReply(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const stateKey = `${chatId}_${userId}`;
    const state = donationState[stateKey];

    if (!state || !msg.reply_to_message || msg.reply_to_message.message_id !== state.promptMessageId) {
        return false;
    }

    const amount = parseInt(msg.text.trim(), 10);

    try {
        if (isNaN(amount) || amount <= 0) {
            return bot.sendMessage(chatId, '❌ مبلغ وارد شده نامعتبر است. لطفاً یک عدد صحیح و مثبت وارد کنید.', { reply_to_message_id: msg.message_id });
        }

        const user = await User.findByPk(userId);
        const shelter = await Shelter.findByPk(chatId);

        if (state.type === 'coin') {
            if (user.coins < amount) {
                return bot.sendMessage(chatId, '🪙 سکه شما برای اهدای این مبلغ کافی نیست.', { reply_to_message_id: msg.message_id });
            }
            user.coins -= amount;
            shelter.treasury += amount;
            await user.save();
            await shelter.save();
            await bot.sendMessage(chatId, `✅ **اهدا با موفقیت انجام شد!**\n\nبازمانده ${user.firstName} مبلغ **${amount}** سکه به خزانه پناهگاه اهدا کرد.\n\n- موجودی جدید شما: ${user.coins} سکه\n- موجودی جدید خزانه: ${shelter.treasury} سکه`, { parse_mode: 'Markdown' });
        } else if (state.type === 'fuel') {
            if (user.fuel < amount) {
                return bot.sendMessage(chatId, '⛽️ سوخت شما برای اهدای این مقدار کافی نیست.', { reply_to_message_id: msg.message_id });
            }
            const currentLevelInfo = TANKER_CONFIG.levels[shelter.fuelTankerLevel];
            if (shelter.fuelTankerContent + amount > currentLevelInfo.capacity) {
                return bot.sendMessage(chatId, 'تانکر پناهگاه ظرفیت کافی برای این مقدار سوخت را ندارد.', { reply_to_message_id: msg.message_id });
            }
            user.fuel -= amount;
            shelter.fuelTankerContent += amount;
            await user.save();
            await shelter.save();
            await bot.sendMessage(chatId, `✅ **اهدا با موفقیت انجام شد!**\n\nبازمانده ${user.firstName} مقدار **${amount}** لیتر سوخت به تانکر پناهگاه اهدا کرد.\n\n- موجودی جدید سوخت شما: ${user.fuel} لیتر\n- موجودی جدید تانکر: ${shelter.fuelTankerContent} لیتر`, { parse_mode: 'Markdown' });
        }

    } catch (error) {
        console.error('Error in handleDonationReply:', error);
        await bot.sendMessage(chatId, '❌ خطایی در فرآیند اهدا رخ داد.');
    } finally {
        delete donationState[stateKey];
    }

    return true;
}

module.exports = { handleManageShelterCommand, handleShelterManagerCallback, handleDonationReply, donationState };