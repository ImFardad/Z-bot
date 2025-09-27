const { adminId } = require('../config');

const menus = {
  main: {
    text: (name) => `سلام ${name}!\n\nبه ربات ما خوش آمدید. لطفاً یکی از گزینه‌های زیر را انتخاب کنید:`, 
    options: (userId) => {
      const keyboard = [
        [{ text: '🧟 سناریو زامبی', callback_data: 'action:start_zombie' }],
        [{ text: '🏕️ پناهگاه', callback_data: 'action:manage_shelter' }],
        [{ text: '🏆 امتیاز من', callback_data: 'action:show_score' }],
      ];

      // Add admin panel button if the user is an admin
      if (userId && userId.toString() === adminId) {
        keyboard.push([{ text: '👑 پنل ادمین', callback_data: 'navigate:admin:main' }]);
      }

      return {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      };
    },
  },
  admin: {
    text: '👑 پنل مدیریت ربات',
    options: {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗑 پاکسازی تاریخچه سوالات', callback_data: 'admin:clear_history:admin' }],
        ],
      },
    },
  },
  confirmClearHistory: {
    text: '⚠️ **اخطار!**\n\nآیا از پاک کردن **تمام** تاریخچه سوالات پرسیده شده توسط **تمام کاربران** مطمئن هستید؟\nاین عمل غیرقابل بازگشت است.',
    options: {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '❌ نه، لغو کن', callback_data: 'navigate:admin:main' }, // Go back to admin panel
            { text: '✅ بله، پاک کن', callback_data: 'admin_confirm:clear_history:admin' }, // Pass parent
          ],
        ],
      },
    },
  },
};

module.exports = { menus };