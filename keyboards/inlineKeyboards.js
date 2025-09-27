const { adminId } = require('../config');

const menus = {
  main: {
    text: (name) => `سلام **${name}**، به دنیای Z-Bot خوش آمدی!\n\nاز طریق منوی زیر می‌توانی برای بقا تلاش کنی:`,
    options: (userId) => {
      const keyboard = [
        [{ text: '🧟 سناریو زامبی', callback_data: 'action:start_zombie' }],
        [{ text: '🏕️ پناهگاه', callback_data: 'action:manage_shelter' }],
        [{ text: '🏆 احتمال بقا', callback_data: 'action:show_score' }],
      ];

      // Add admin panel button if the user is an admin
      if (userId && userId.toString() === adminId) {
        keyboard.push([{ text: '👑 پنل ادمین', callback_data: 'navigate:admin:main' }]);
      }

      return {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard,
        },
      };
    },
  },
  admin: {
    text: '**👑 پنل مدیریت**',
    options: {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗑 پاکسازی تاریخچه سناریوها', callback_data: 'admin:clear_history:admin' }],
        ],
      },
    },
  },
  confirmClearHistory: {
    text: '**⚠️ تایید عملیات**\n\nآیا از پاک کردن **تمام** تاریخچه سناریوهای پرسیده شده توسط **تمام کاربران** مطمئن هستید؟\n\n*این عمل غیرقابل بازگشت است و تمام رکوردهای مربوط به سناریوها از دیتابیس حذف خواهد شد.* ',
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