const Shelter = require('../db/Shelter');
const User = require('../db/User');

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

    // Basic permission check
    const user = await User.findByPk(userId);
    if (!user || user.shelterId !== chatId) {
        return bot.answerCallbackQuery(callbackQuery.id, { text: 'شما عضو این پناهگاه نیستید.', show_alert: true });
    }

    // --- Treasury Menu ---
    if (route === 'treasury') {
        const shelter = await Shelter.findByPk(chatId);
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

    // --- Back to Main Shelter Menu ---
    if (route === 'main') {
        const shelter = await Shelter.findByPk(chatId);
        const text = `**🛠️ مدیریت پناهگاه «${shelter.name}»**\n\n- **خزانه:** ${shelter.treasury} سکه 🪙`;
        const keyboard = {
            inline_keyboard: [
                [{ text: '💰 خزانه', callback_data: 'shelter_manage:treasury' }],
            ],
        };
        await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard });
        return true;
    }

    // --- Donation Prompt ---
    if (route === 'donate_prompt') {
        const promptText = `**🎁 اهدا به خزانه**\n\nموجودی شما: **${user.coins}** سکه 🪙\n\nلطفاً مبلغ مورد نظر برای اهدا را در پاسخ به همین پیام ارسال کنید.`;
        const promptMessage = await bot.sendMessage(chatId, promptText, { parse_mode: 'Markdown' });
        
        donationState[`${chatId}_${userId}`] = { promptMessageId: promptMessage.message_id };
        await bot.answerCallbackQuery(callbackQuery.id);
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
        if (user.coins < amount) {
            return bot.sendMessage(chatId, '🪙 سکه شما برای اهدای این مبلغ کافی نیست.', { reply_to_message_id: msg.message_id });
        }

        const shelter = await Shelter.findByPk(chatId);

        user.coins -= amount;
        shelter.treasury += amount;

        await user.save();
        await shelter.save();

        await bot.sendMessage(chatId, `✅ **اهدا با موفقیت انجام شد!**\n\nبازمانده ${user.firstName} مبلغ **${amount}** سکه به خزانه پناهگاه اهدا کرد.\n\n- موجودی جدید شما: ${user.coins} سکه\n- موجودی جدید خزانه: ${shelter.treasury} سکه`, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error('Error in handleDonationReply:', error);
        await bot.sendMessage(chatId, '❌ خطایی در فرآیند اهدا رخ داد.');
    } finally {
        delete donationState[stateKey];
    }

    return true;
}


module.exports = { handleManageShelterCommand, handleShelterManagerCallback, handleDonationReply, donationState };