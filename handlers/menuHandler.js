const { menus } = require('../keyboards/inlineKeyboards');
const { startZombieScenario } = require('./zombieHandler');
const {
  handleManageShelter,
  handleJoinShelter,
  handleLeaveShelterConfirm,
  handleLeaveShelterDo,
} = require('./shelterHandler');
const { handleStart, activeMenuMessages } = require('./startHandler');
const User = require('../db/User');
const _ = require('lodash');

const userActionLocks = new Set();

async function handleMenuCallback(bot, callbackQuery) {
  const user = callbackQuery.from;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const queryData = callbackQuery.data;

  // Answer the callback query immediately to prevent timeout errors,
  // unless it's an action that needs to show an alert.
  if (queryData !== 'action:show_score') {
    try {
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch {
      /* ignore */
    }
  }

  // Active Menu Check
  if (activeMenuMessages[chatId] && activeMenuMessages[chatId] !== messageId) {
    try {
            await bot.deleteMessage(chatId, messageId);
          } catch {
            /* Ignore */
          }    // We don't need to answer the query again here as it's likely already answered or invalid.
    return;
  }

  // Action Lock
  if (userActionLocks.has(user.id)) {
    // We can't show an alert here as the query is likely answered, but we can just ignore the spam.
    return;
  }

  try {
    userActionLocks.add(user.id);

    // --- Shelter Actions ---
    if (queryData.startsWith('shelter_join:')) {
      await handleJoinShelter(bot, callbackQuery, queryData.split(':')[1]);
      return;
    }
    if (queryData === 'shelter_leave_confirm') {
      await handleLeaveShelterConfirm(bot, callbackQuery);
      return;
    }
    if (queryData === 'shelter_leave_do') {
      await handleLeaveShelterDo(bot, callbackQuery);
      return;
    }

    // --- Navigation ---
    if (queryData.startsWith('navigate:')) {
      const parts = queryData.split(':');
      const menuName = parts[1];
      const parentMenuName = parts.length > 2 ? parts[2] : null;

      if (menuName === 'main') {
        await handleStart(bot, { chat: { id: chatId }, from: user });
        return;
      }

      const targetMenu = menus[menuName];
      if (targetMenu) {
        const text =
          typeof targetMenu.text === 'function'
            ? targetMenu.text(user.first_name)
            : targetMenu.text;
        const options = _.cloneDeep(
          typeof targetMenu.options === 'function'
            ? targetMenu.options(user.id)
            : targetMenu.options
        );

        if (parentMenuName) {
          if (!options.reply_markup) options.reply_markup = {};
          if (!options.reply_markup.inline_keyboard)
            options.reply_markup.inline_keyboard = [];
          options.reply_markup.inline_keyboard.push([
            { text: '➡️ بازگشت', callback_data: `navigate:${parentMenuName}` },
          ]);
        }

        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          ...options,
        });
      }
      return;
    }

    // --- User Actions ---
    if (queryData.startsWith('action:')) {
      const actionName = queryData.split(':')[1];

      if (actionName === 'start_zombie') {
        await startZombieScenario(bot, callbackQuery);
      } else if (actionName === 'manage_shelter') {
        await handleManageShelter(bot, callbackQuery);
      } else if (actionName === 'show_score') {
        try {
          const userRecord = await User.findByPk(user.id);
          const survivalPercentage = userRecord
            ? userRecord.survivalPercentage
            : 0;
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: `🧟 احتمال بقا: ${survivalPercentage.toFixed(2)}%`,
            show_alert: true,
          });
        } catch (error) {
          console.error('Failed to retrieve user score:', error);
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'خطایی در دریافت امتیاز رخ داد.',
            show_alert: true,
          });
        }
      }
      return;
    }
  } catch (error) {
    console.error('An error occurred in handleMenuCallback:', error);
  } finally {
    userActionLocks.delete(user.id);
  }
}

module.exports = { handleMenuCallback };
