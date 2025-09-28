const { adminId } = require('../config');

const menus = {
  main: {
    text: (name) =>
      `سلام **${name}**، به آخرالزمان خوش آمدی!\n\nاز طریق منوی زیر می‌توانی برای بقا تلاش کنی:`,
    options: (user) => {
      const keyboard = [
        [{ text: '🧟 سناریو زامبی', callback_data: 'action:start_zombie' }],
        [{ text: '🏕️ پناهگاه', callback_data: 'action:manage_shelter' }],
        [{ text: '🛒 فروشگاه', callback_data: 'action:open_shop' }],
        [{ text: '🏆 احتمال بقا', callback_data: 'action:show_score' }],
      ];

      if (user && user.backpackLevel > 0) {
        // Insert the backpack button before the shop button
        keyboard.splice(2, 0, [
          { text: '🎒 کوله پشتی', callback_data: 'action:open_backpack' },
        ]);
      }

      if (user && user.id.toString() === adminId) {
        keyboard.push([
          { text: '👑 پنل ادمین', callback_data: 'navigate:admin:main' },
        ]);
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
          [
            {
              text: '🗑 پاکسازی تاریخچه سناریوها',
              callback_data: 'admin:clear_history:admin',
            },
          ],
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
            { text: '❌ نه، لغو کن', callback_data: 'navigate:admin:main' },
            {
              text: '✅ بله، پاک کن',
              callback_data: 'admin_confirm:clear_history:admin',
            },
          ],
        ],
      },
    },
  },
};

module.exports = { menus };