const User = require('../db/User');
const Shelter = require('../db/Shelter');
const UserPossibleShelter = require('../db/UserPossibleShelter');
const allProvinces = require('../iran/provinces.json');
const allCities = require('../iran/cities.json');

// This object holds the state of any active shelter creation process, keyed by chatId.
const creationState = {};

/**
 * Starts the shelter creation process in a group.
 * - Checks for admin privileges.
 * - Ensures no other creation is in progress.
 * - Asks the first question (shelter name).
 */
async function handleCreateShelterCommand(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const chatType = msg.chat.type;

  if (chatType !== 'group' && chatType !== 'supergroup') {
    try { await bot.sendMessage(chatId, 'این دستور فقط در گروه‌ها قابل استفاده است.'); } catch (e) { console.error(e); }
    return;
  }

  const existingShelter = await Shelter.findByPk(chatId);
  if (existingShelter) {
    try {
      const members = await User.findAll({
        where: { shelterId: chatId },
        attributes: ['firstName', 'lastName'],
      });

      let memberList = '\n**اعضای پناهگاه:**\n';
      if (members.length > 0) {
        memberList += members.map((m, i) => `${i + 1}. ${[m.firstName, m.lastName].filter(Boolean).join(' ')}`).join('\n');
      } else {
        memberList += 'هنوز عضوی وجود ندارد.';
      }

      const infoText = `🏕️ **اطلاعات پناهگاه**\n\n- **نام:** ${existingShelter.name}\n- **استان:** ${existingShelter.province}\n- **شهر:** ${existingShelter.city}${memberList}`;
      
      await bot.sendMessage(chatId, infoText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ پیوستن به پناهگاه', callback_data: `shelter:join:${chatId}` }]
          ]
        }
      });
    } catch (error) {
      console.error('Error displaying existing shelter info:', error);
      await bot.sendMessage(chatId, 'خطایی در نمایش اطلاعات پناهگاه رخ داد.');
    }
    return;
  }

  if (creationState[chatId]) {
    try { await bot.sendMessage(chatId, 'یک فرآیند ساخت پناهگاه در این گروه در حال انجام است. لطفاً ابتدا آن را تکمیل یا لغو کنید.'); } catch (e) { console.error(e); }
    return;
  }

  try {
    const chatMember = await bot.getChatMember(chatId, userId);
    if (!['creator', 'administrator'].includes(chatMember.status)) {
      await bot.sendMessage(chatId, 'فقط ادمین‌های گروه می‌توانند پناهگاه جدید ایجاد کنند.');
      return;
    }

    const promptText = '🏕️ **شروع ساخت پناهگاه**\n\nمرحله ۱ از ۳: نام پناهگاه\n\nلطفاً نام مورد نظر برای پناهگاه خود را در پاسخ به همین پیام ارسال کنید.';
    const promptMessage = await bot.sendMessage(chatId, promptText, { parse_mode: 'Markdown' });

    creationState[chatId] = {
      step: 'awaiting_name',
      initiator: userId,
      promptMessageId: promptMessage.message_id,
      data: {},
    };

  } catch (error) {
    console.error('Error in handleCreateShelterCommand:', error);
    try { await bot.sendMessage(chatId, 'خطایی در شروع فرآیند ساخت پناهگاه رخ داد.'); } catch (e) { console.error(e); }
  }
}

/**
 * Handles user replies during the shelter creation process.
 * It checks which step the user is on and processes the input accordingly.
 */
async function handleCreationReply(bot, msg) {
  const chatId = msg.chat.id;
  const state = creationState[chatId];

  if (!state || !msg.reply_to_message || msg.from.id !== state.initiator || msg.reply_to_message.message_id !== state.promptMessageId) {
    return false;
  }

  const userInput = msg.text.trim();

  try {
    // Step 1: Awaiting Name
    if (state.step === 'awaiting_name') {
      state.data.name = userInput;
      state.step = 'awaiting_province';
      const promptText = `✅ نام پناهگاه ثبت شد: **${userInput}**\n\nمرحله ۲ از ۳: استان\n\nلطفاً نام استان محل پناهگاه را ارسال کنید.`;
      const promptMessage = await bot.sendMessage(chatId, promptText, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
      state.promptMessageId = promptMessage.message_id;
      return true;
    }

    // Step 2: Awaiting Province
    if (state.step === 'awaiting_province') {
      const exactMatch = allProvinces.find(p => p.name === userInput);
      if (exactMatch) {
        state.data.province = exactMatch;
        state.step = 'awaiting_city';
        const promptText = `✅ استان ثبت شد: **${exactMatch.name}**\n\nمرحله ۳ از ۳: شهر\n\nلطفاً نام شهر محل پناهگاه را در استان ${exactMatch.name} ارسال کنید.`;
        const promptMessage = await bot.sendMessage(chatId, promptText, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
        state.promptMessageId = promptMessage.message_id;
      } else {
        const suggestions = allProvinces.filter(p => p.name.includes(userInput)).slice(0, 5);
        if (suggestions.length > 0) {
          const keyboard = suggestions.map(p => ([{ text: p.name, callback_data: `creation:province:${p.id}` }]));
          const promptText = 'استان وارد شده یافت نشد. آیا منظورتان یکی از موارد زیر است؟\n\nاگر استان شما در لیست نیست، لطفاً نام آن را با دقت بیشتر دوباره ارسال کنید.';
          const promptMessage = await bot.sendMessage(chatId, promptText, { reply_to_message_id: msg.message_id, reply_markup: { inline_keyboard: keyboard } });
          state.promptMessageId = promptMessage.message_id;
        } else {
          const promptMessage = await bot.sendMessage(chatId, 'استان وارد شده یافت نشد. لطفاً نام استان را با دقت بیشتر دوباره ارسال کنید.', { reply_to_message_id: msg.message_id });
          state.promptMessageId = promptMessage.message_id;
        }
      }
      return true;
    }

    // Step 3: Awaiting City
    if (state.step === 'awaiting_city') {
      const provinceId = state.data.province.id;
      const citiesInProvince = allCities.filter(c => c.province_id === provinceId);
      const exactMatch = citiesInProvince.find(c => c.name === userInput);
      if (exactMatch) {
        state.data.city = exactMatch;
        await finalizeShelterCreation(bot, chatId);
      } else {
        const suggestions = citiesInProvince.filter(c => c.name.includes(userInput)).slice(0, 5);
        if (suggestions.length > 0) {
          const keyboard = suggestions.map(c => ([{ text: c.name, callback_data: `creation:city:${c.id}` }]));
          const promptText = 'شهر وارد شده یافت نشد. آیا منظورتان یکی از موارد زیر است؟\n\nاگر شهر شما در لیست نیست، لطفاً نام آن را با دقت بیشتر دوباره ارسال کنید.';
          const promptMessage = await bot.sendMessage(chatId, promptText, { reply_to_message_id: msg.message_id, reply_markup: { inline_keyboard: keyboard } });
          state.promptMessageId = promptMessage.message_id;
        } else {
          const promptMessage = await bot.sendMessage(chatId, 'شهر وارد شده یافت نشد. لطفاً نام شهر را با دقت بیشتر دوباره ارسال کنید.', { reply_to_message_id: msg.message_id });
          state.promptMessageId = promptMessage.message_id;
        }
      }
      return true;
    }
  } catch (error) {
    console.error('Error in handleCreationReply:', error);
    await bot.sendMessage(chatId, 'خطایی در پردازش پاسخ شما رخ داد.');
    return true;
  }

  return false;
}

/**
 * Handles callbacks from the suggestion keyboards for provinces and cities.
 */
async function handleCreationCallback(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const state = creationState[chatId];
  const queryData = callbackQuery.data;

  if (!queryData.startsWith('creation:')) return false;

  if (!state || userId !== state.initiator) {
    try { await bot.answerCallbackQuery(callbackQuery.id, { text: 'شما مجاز به انجام این کار نیستید.', show_alert: true }); } catch (e) { /* ignore */ }
    return true;
  }

  try {
    await bot.answerCallbackQuery(callbackQuery.id);
    const [, type, selectedId] = queryData.split(':');

    if (type === 'province') {
      const province = allProvinces.find(p => p.id == selectedId);
      if (province) {
        state.data.province = province;
        state.step = 'awaiting_city';
        try { await bot.deleteMessage(chatId, callbackQuery.message.message_id); } catch (e) { /* ignore */ }
        const promptText = `✅ استان ثبت شد: **${province.name}**\n\nمرحله ۳ از ۳: شهر\n\nلطفاً نام شهر محل پناهگاه را در استان ${province.name} ارسال کنید.`;
        const promptMessage = await bot.sendMessage(chatId, promptText, { parse_mode: 'Markdown' });
        state.promptMessageId = promptMessage.message_id;
      }
    } else if (type === 'city') {
      const city = allCities.find(c => c.id == selectedId);
      if (city) {
        state.data.city = city;
        try { await bot.deleteMessage(chatId, callbackQuery.message.message_id); } catch (e) { /* ignore */ }
        await finalizeShelterCreation(bot, chatId);
      }
    }
    return true;
  } catch (error) {
    console.error('Error in handleCreationCallback:', error);
    return true;
  }
}

/**
 * Saves the completed shelter data to the database.
 */
async function finalizeShelterCreation(bot, chatId) {
  const state = creationState[chatId];
  if (!state || !state.data.name || !state.data.province || !state.data.city) {
    console.error('Finalizing creation failed due to incomplete state:', state);
    await bot.sendMessage(chatId, 'خطایی رخ داد. برخی اطلاعات ضروری برای ساخت پناهگاه ناقص است.');
    delete creationState[chatId];
    return;
  }

  const shelterData = {
    id: chatId,
    name: state.data.name,
    province: state.data.province.name,
    city: state.data.city.name,
  };

  try {
    await Shelter.upsert(shelterData);
    await User.update({ shelterId: chatId }, { where: { id: state.initiator } });

    const initiatorUser = await User.findByPk(state.initiator);
    const initiatorName = [initiatorUser.firstName, initiatorUser.lastName].filter(Boolean).join(' ');

    const successText = `🏕️ **پناهگاه با موفقیت ایجاد شد!**\n\n- **نام:** ${shelterData.name}\n- **استان:** ${shelterData.province}\n- **شهر:** ${shelterData.city}\n\n**${initiatorName}** (سازنده) به طور خودکار به پناهگاه ملحق شد.\n\nسایر اعضای گروه می‌توانند در چت خصوصی با من، از طریق منوی «پناهگاه»، به اینجا ملحق شوند.`;
    await bot.sendMessage(chatId, successText, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Error finalizing shelter creation:', error);
    await bot.sendMessage(chatId, 'خطایی در ذخیره اطلاعات پناهگاه رخ داد. جزئیات خطا در لاگ سرور ثبت شده است.');
  } finally {
    delete creationState[chatId];
  }
}

async function handleShelterJoinCallback(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const queryData = callbackQuery.data;

  if (!queryData.startsWith('shelter:join:')) return false;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      // This should ideally not happen if they are interacting with the bot
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'ابتدا باید ربات را در چت خصوصی استارت کنید.', show_alert: true });
      return true;
    }

    if (user.shelterId === chatId) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'شما قبلاً عضو این پناهگاه شده‌اید.', show_alert: true });
    } else {
      await User.update({ shelterId: chatId }, { where: { id: userId } });
      await bot.answerCallbackQuery(callbackQuery.id, { text: '✅ به پناهگاه خوش آمدید!' });
      const userName = [user.firstName, user.lastName].filter(Boolean).join(' ');
      await bot.sendMessage(chatId, `🏕️ یک بازمانده جدید به شما پیوست!\n\n«**${userName}**» اکنون عضو این پناهگاه است.`, { parse_mode: 'Markdown' });
    }
    return true;

  } catch (error) {
    console.error('Error in handleShelterJoinCallback:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'خطایی در عضویت رخ داد.', show_alert: true });
    return true;
  }
}

module.exports = {
  handleCreateShelterCommand,
  handleCreationReply,
  handleCreationCallback,
  handleShelterJoinCallback,
};
