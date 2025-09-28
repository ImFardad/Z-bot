const User = require('../db/User');
const Shelter = require('../db/Shelter');
const allProvinces = require('../iran/provinces.json');
const allCities = require('../iran/cities.json');

const creationState = {};

async function handleCreateShelterCommand(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const chatType = msg.chat.type;

  if (chatType !== 'group' && chatType !== 'supergroup') {
    try { 
      const text = '⚠️ **فقط در گروه‌ها**\n\nاین دستور تنها در محیط گروه‌ها قابل استفاده است.';
      await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }); 
    } catch (e) { console.error(e); }
    return;
  }

  const existingShelter = await Shelter.findByPk(chatId);
  if (existingShelter) {
    try {
      const members = await User.findAll({
        where: { shelterId: chatId },
        attributes: ['firstName', 'lastName'],
      });

      let memberList = '\n\n👥 **اعضای پناهگاه:**\n';
      if (members.length > 0) {
        memberList += members.map((m, i) => `${i + 1}. ${[m.firstName, m.lastName].filter(Boolean).join(' ')}`).join('\n');
      } else {
        memberList += 'این پناهگاه هنوز عضوی ندارد.';
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
      const errorText = '❌ **خطا**\n\nمشکلی در نمایش اطلاعات پناهگاه رخ داد. لطفاً دوباره تلاش کنید.';
      await bot.sendMessage(chatId, errorText, { parse_mode: 'Markdown' });
    }
    return;
  }

  if (creationState[chatId]) {
    try { 
      const text = '⚠️ **عملیات نیمه‌کاره**\n\nیک فرآیند ساخت پناهگاه در این گروه از قبل شروع شده است. لطفاً ابتدا آن را تکمیل کرده یا برای لغو، با ادمین گروه صحبت کنید.';
      await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }); 
    } catch (e) { console.error(e); }
    return;
  }

  try {
    const chatMember = await bot.getChatMember(chatId, userId);
    if (!['creator', 'administrator'].includes(chatMember.status)) {
      const text = '⛔️ **عدم دسترسی**\n\nاین دستور فقط توسط سازنده و ادمین‌های گروه قابل اجرا است.';
      await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      return;
    }

    const promptText = '**🏕️ شروع فرآیند ساخت پناهگاه**\n\nمرحله ۱ از ۳: **انتخاب نام**\n\nلطفاً نام مورد نظر برای پناهگاه را در پاسخ به همین پیام ارسال کنید.';
    const promptMessage = await bot.sendMessage(chatId, promptText, { parse_mode: 'Markdown' });

    creationState[chatId] = {
      step: 'awaiting_name',
      initiator: userId,
      promptMessageId: promptMessage.message_id,
      data: {},
    };

  } catch (error) {
    console.error('Error in handleCreateShelterCommand:', error);
    try { 
      const errorText = '❌ **خطا**\n\nمشکلی در شروع فرآیند ساخت پناهگاه رخ داد. لطفاً دوباره تلاش کنید.';
      await bot.sendMessage(chatId, errorText, { parse_mode: 'Markdown' }); 
    } catch (e) { console.error(e); }
  }
}

async function handleCreationReply(bot, msg) {
  const chatId = msg.chat.id;
  const state = creationState[chatId];

  if (!state || !msg.reply_to_message || msg.from.id !== state.initiator || msg.reply_to_message.message_id !== state.promptMessageId) {
    return false;
  }

  const userInput = msg.text.trim();

  try {
    if (state.step === 'awaiting_name') {
      state.data.name = userInput;
      state.step = 'awaiting_province';
      const promptText = `✅ نام پناهگاه: **${userInput}**\n\n---\n\nمرحله ۲ از ۳: **انتخاب استان**\n\nلطفاً نام استان محل پناهگاه را ارسال کنید.`;
      const promptMessage = await bot.sendMessage(chatId, promptText, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
      state.promptMessageId = promptMessage.message_id;
      return true;
    }

    if (state.step === 'awaiting_province') {
      const exactMatch = allProvinces.find(p => p.name === userInput);
      if (exactMatch) {
        state.data.province = exactMatch;
        state.step = 'awaiting_city';
        const promptText = `✅ استان: **${exactMatch.name}**\n\n---\n\nمرحله ۳ از ۳: **انتخاب شهر**\n\nلطفاً نام شهر مورد نظر در این استان را ارسال کنید.`;
        const promptMessage = await bot.sendMessage(chatId, promptText, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
        state.promptMessageId = promptMessage.message_id;
      } else {
        const suggestions = allProvinces.filter(p => p.name.includes(userInput)).slice(0, 5);
        if (suggestions.length > 0) {
          const keyboard = suggestions.map(p => ([{ text: p.name, callback_data: `creation:province:${p.id}` }]));
          const promptText = '⚠️ **استان یافت نشد**\n\nآیا منظورتان یکی از موارد زیر است؟\n\nاگر استان شما در لیست نیست، لطفاً نام آن را با دقت و املای صحیح دوباره ارسال کنید.';
          const promptMessage = await bot.sendMessage(chatId, promptText, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id, reply_markup: { inline_keyboard: keyboard } });
          state.promptMessageId = promptMessage.message_id;
        } else {
          const promptText = '❌ **استان نامعتبر**\n\nاستان وارد شده در لیست استان‌های ایران یافت نشد. لطفاً نام استان را با دقت و املای صحیح دوباره ارسال کنید.';
          const promptMessage = await bot.sendMessage(chatId, promptText, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
          state.promptMessageId = promptMessage.message_id;
        }
      }
      return true;
    }

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
          const promptText = '⚠️ **شهر یافت نشد**\n\nآیا منظورتان یکی از موارد زیر است؟\n\nاگر شهر شما در لیست نیست، لطفاً نام آن را با دقت و املای صحیح دوباره ارسال کنید.';
          const promptMessage = await bot.sendMessage(chatId, promptText, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id, reply_markup: { inline_keyboard: keyboard } });
          state.promptMessageId = promptMessage.message_id;
        } else {
          const promptText = '❌ **شهر نامعتبر**\n\nشهر وارد شده در لیست شهرهای این استان یافت نشد. لطفاً نام شهر را با دقت و املای صحیح دوباره ارسال کنید.';
          const promptMessage = await bot.sendMessage(chatId, promptText, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
          state.promptMessageId = promptMessage.message_id;
        }
      }
      return true;
    }
  } catch (error) {
    console.error('Error in handleCreationReply:', error);
    const errorText = '❌ **خطا**\n\nمتاسفانه در پردازش پاسخ شما خطایی رخ داد. لطفاً دوباره تلاش کنید.';
    await bot.sendMessage(chatId, errorText, { parse_mode: 'Markdown' });
    return true;
  }

  return false;
}

async function handleCreationCallback(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const state = creationState[chatId];
  const queryData = callbackQuery.data;

  if (!queryData.startsWith('creation:')) return false;

  if (!state || userId !== state.initiator) {
    try { await bot.answerCallbackQuery(callbackQuery.id, { text: '⛔️ این عملیات فقط توسط شروع‌کننده آن قابل انجام است.', show_alert: true }); } catch (e) { /* ignore */ }
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
        const promptText = `✅ استان: **${province.name}**\n\n---\n\nمرحله ۳ از ۳: **انتخاب شهر**\n\nلطفاً نام شهر مورد نظر در این استان را ارسال کنید.`;
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

async function finalizeShelterCreation(bot, chatId) {
  const state = creationState[chatId];
  if (!state || !state.data.name || !state.data.province || !state.data.city) {
    console.error('Finalizing creation failed due to incomplete state:', state);
    const errorText = '❌ **خطای داخلی**\n\nفرآیند ساخت پناهگاه به دلیل نقص اطلاعات متوقف شد. لطفاً دوباره تلاش کنید.';
    await bot.sendMessage(chatId, errorText, { parse_mode: 'Markdown' });
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

    const successText = `**🏕️ پناهگاه «${shelterData.name}» با موفقیت ایجاد شد!**\n\n**اطلاعات پناهگاه:**\n- استان: ${shelterData.province}\n- شهر: ${shelterData.city}\n\nسایر اعضا می‌توانند با استفاده از دکمه «پیوستن به پناهگاه» که با دستور /shelter ظاهر می‌شود، عضو شوند.`;
    await bot.sendMessage(chatId, successText, { parse_mode: 'Markdown' });

    const joinNotificationText = `➕ **یک بازمانده جدید به پناهگاه پیوست!**\n\nبازمانده «${initiatorName}» (سازنده) اکنون عضو این پناهگاه است.`;
    await bot.sendMessage(chatId, joinNotificationText, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Error finalizing shelter creation:', error);
    const errorText = '❌ **خطای پایگاه داده**\n\nمشکلی در ذخیره اطلاعات نهایی پناهگاه رخ داد. لطفاً دوباره تلاش کنید.';
    await bot.sendMessage(chatId, errorText, { parse_mode: 'Markdown' });
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
      await bot.answerCallbackQuery(callbackQuery.id, { text: '⚠️ برای عضویت، ابتدا ربات را در چت خصوصی استارت کنید.', show_alert: true });
      return true;
    }

    if (user.shelterId === chatId) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: '✅ شما از قبل عضو این پناهگاه هستید.', show_alert: true });
    } else {
      await User.update({ shelterId: chatId }, { where: { id: userId } });
      await bot.answerCallbackQuery(callbackQuery.id, { text: '✅ شما با موفقیت به پناهگاه ملحق شدید!' });
      const userName = [user.firstName, user.lastName].filter(Boolean).join(' ');
      const text = `➕ **یک بازمانده جدید به پناهگاه پیوست!**\n\nبازمانده «${userName}» اکنون عضو این پناهگاه است.`;
      await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    }
    return true;

  } catch (error) {
    console.error('Error in handleShelterJoinCallback:', error);
    const errorText = '❌ **خطا**\n\nمشکلی در فرآیند عضویت شما رخ داد. لطفاً دوباره تلاش کنید.';
    await bot.answerCallbackQuery(callbackQuery.id, { text: errorText, show_alert: true });
    return true;
  }
}

module.exports = {
  handleCreateShelterCommand,
  handleCreationReply,
  handleCreationCallback,
  handleShelterJoinCallback,
};