import { createBot, inlineButton, inlineKeyboard, menuKeyboard, type InlineKeyboardMarkup } from "./toolkit/index.js";
import { getLocaleStorage, getReminderStorage, getUserDataStorage } from "./storage.js";
import { scheduleReminder, cancelReminder } from "./reminder.js";

// The per-chat session shape (ephemeral conversation state only). Extend as the
// bot grows. Durable domain data must NOT live here — use the toolkit's
// persistent storage (see AGENTS.md).
export interface Session {
  lessonPage?: number;
  awaitingReminderTime?: boolean;
}

const MAIN_MENU: ReadonlyArray<{ text: string; data: string }> = [
  { text: "📚 Micro-Lessons", data: "menu:lesson" },
  { text: "🎯 Practice", data: "menu:practice" },
  { text: "⭐ Buy Stars", data: "menu:buy" },
  { text: "⏰ Reminders", data: "menu:reminders" },
  { text: "📊 Stats", data: "menu:stats" },
  { text: "ℹ️ Help", data: "menu:help" },
];

const MAIN_MENU_KEYBOARD: InlineKeyboardMarkup = menuKeyboard(MAIN_MENU);

const LOCALES: ReadonlyArray<{ code: string; name: string }> = [
  { code: "en", name: "🇬🇧 English" },
  { code: "es", name: "🇪🇸 Español" },
  { code: "fr", name: "🇫🇷 Français" },
  { code: "de", name: "🇩🇪 Deutsch" },
  { code: "ru", name: "🇷🇺 Русский" },
  { code: "zh", name: "🇨🇳 中文" },
  { code: "ar", name: "🇸🇦 العربية" },
];

const LOCALE_MENU_KEYBOARD: InlineKeyboardMarkup = inlineKeyboard(
  LOCALES.map((loc) => [inlineButton(loc.name, `locale:set:${loc.code}`)]),
);

const KNOWN_COMMANDS = new Set(["start", "help", "buy", "lesson", "practice", "reminders", "reminderoff", "stats", "locale"]);

function welcomeText(): string {
  return "Welcome to AGNTDEV! 🎉\n\nI'm your learning companion. Choose an option below to get started:";
}

const MICRO_LESSONS: readonly string[] = [
  "Practice daily to improve quickly.",
  "Small steps lead to mastery.",
  "Review past lessons every week.",
  "Consistency beats intensity every time.",
];

function lessonMessage(page: number): string {
  const lesson = MICRO_LESSONS[page];
  return `📖 Lesson ${page + 1} of ${MICRO_LESSONS.length}\n\n${lesson}`;
}

function lessonKeyboard(page: number): InlineKeyboardMarkup {
  const total = MICRO_LESSONS.length;
  const row: Array<{ text: string; data: string }> = [];
  if (page > 0) {
    row.push({ text: "← Prev", data: `lesson:prev:${page - 1}` });
  }
  if (page < total - 1) {
    row.push({ text: "Next →", data: `lesson:next:${page + 1}` });
  }
  return menuKeyboard(row, row.length);
}

/**
 * buildBot — assembles the bot and registers every handler, but does NOT start
 * it. Shared by the runtime entry (src/index.ts) and the Tests-gate harness
 * (src/harness-entry.ts) so both exercise the exact same bot. Add new commands
 * and flows here.
 */
export function buildBot(token: string) {
  const bot = createBot<Session>(token, {
    initial: () => ({}),
  });

  bot.command("start", async (ctx) => {
    await ctx.reply(welcomeText(), { reply_markup: MAIN_MENU_KEYBOARD });
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "Available commands:\n" +
      "/start — Main menu\n" +
      "/buy — Buy Stars\n" +
      "/lesson — Micro-lessons\n" +
      "/practice — Practice quizzes\n" +
      "/reminders — Daily reminders\n" +
      "/reminderoff — Turn off reminders\n" +
      "/stats — View your stats\n" +
      "/locale — Set language\n" +
      "/help — Show this help"
    );
  });

  bot.command("lesson", async (ctx) => {
    ctx.session.lessonPage = 0;
    await ctx.reply(lessonMessage(0), { reply_markup: lessonKeyboard(0) });
  });

  bot.command("buy", async (ctx) => {
    await ctx.replyWithInvoice(
      "10 Stars",
      "10 Stars package ($1.99)",
      "buy_stars_10",
      "XTR",
      [{ label: "10 Stars", amount: 10 }],
      { provider_token: "" },
    );
  });

  bot.command("locale", async (ctx) => {
    if (!ctx.from) return;
    const userId = String(ctx.from.id);
    const localeStorage = getLocaleStorage();
    const current = await localeStorage.read(userId);
    const currentLocale = current?.locale ?? "en";
    const localeName = LOCALES.find((l) => l.code === currentLocale)?.name ?? currentLocale;
    await ctx.reply(
      `Your current language: ${localeName}\n\nChoose a language:`,
      { reply_markup: LOCALE_MENU_KEYBOARD },
    );
  });

  bot.command("reminders", async (ctx) => {
    if (!ctx.from) return;
    const userId = String(ctx.from.id);
    const reminderStorage = getReminderStorage();
    const current = await reminderStorage.read(userId);
    const currentTime = current?.time ?? "09:00";
    const defaultNote = current ? "" : " (default)";
    ctx.session.awaitingReminderTime = true;
    await ctx.reply(
      `Your daily reminder time: ${currentTime}${defaultNote}\n\nSend your preferred time in 24-hour HH:MM format (e.g., 14:30).`,
    );
  });

  bot.command("reminderoff", async (ctx) => {
    if (!ctx.from) return;
    const userId = String(ctx.from.id);
    const reminderStorage = getReminderStorage();
    const current = await reminderStorage.read(userId);
    if (!current) {
      await ctx.reply("No reminder is currently scheduled.");
      return;
    }
    await reminderStorage.delete(userId);
    await cancelReminder(userId);
    await ctx.reply("Daily reminders turned off. Send /reminders to schedule again.");
  });

  bot.callbackQuery("menu:help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Available commands:\n/start — Main menu\n/buy — Buy Stars\n/lesson — Micro-lessons\n/practice — Practice quizzes\n/reminders — Daily reminders\n/reminderoff — Turn off reminders\n/stats — View your stats\n/locale — Set language\n/help — Show this help");
  });

  bot.callbackQuery("menu:buy", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Use /buy to purchase 10 Stars for $1.99 and unlock premium features.");
  });

  bot.callbackQuery("menu:lesson", async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.lessonPage = 0;
    await ctx.reply(lessonMessage(0), { reply_markup: lessonKeyboard(0) });
  });

  bot.callbackQuery(/^lesson:(next|prev):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const page = parseInt(ctx.match[2], 10);
    if (isNaN(page) || page < 0 || page >= MICRO_LESSONS.length) return;
    ctx.session.lessonPage = page;
    await ctx.editMessageText(lessonMessage(page), { reply_markup: lessonKeyboard(page) });
  });

  bot.callbackQuery("menu:practice", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Use /practice to test your knowledge with interactive quizzes.");
  });

  bot.callbackQuery("menu:reminders", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Use /reminders to set up daily practice reminders at your preferred time. Use /reminderoff to disable them.");
  });

  bot.callbackQuery("menu:stats", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Use /stats to view your learning progress and activity.");
  });

  bot.callbackQuery(/^locale:set:(.+)$/, async (ctx) => {
    const code = ctx.match[1];
    const localeInfo = LOCALES.find((l) => l.code === code);
    if (!localeInfo) {
      await ctx.answerCallbackQuery("Unknown language.");
      return;
    }
    const userId = String(ctx.from.id);
    const localeStorage = getLocaleStorage();
    await localeStorage.write(userId, { locale: code });
    await ctx.answerCallbackQuery();
    await ctx.reply(`Language set to ${localeInfo.name}.`);
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) {
      const cmd = text.split(" ")[0].slice(1).split("@")[0].toLowerCase();
      if (!KNOWN_COMMANDS.has(cmd)) {
        await ctx.reply("Unknown command. Use /help to see available commands.");
      }
      return;
    }
    if (ctx.session.awaitingReminderTime && ctx.from) {
      ctx.session.awaitingReminderTime = false;
      const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
      const match = timeRe.exec(text.trim());
      if (match) {
        const time = match[0];
        const userId = String(ctx.from.id);
        const reminderStorage = getReminderStorage();
        await reminderStorage.write(userId, { time });
        await scheduleReminder(userId, time);
        await ctx.reply(`Reminder time set to ${time}.`);
      } else {
        await ctx.reply(`"${text}" is not a valid 24-hour time (HH:MM). Send /reminders to try again.`);
      }
      return;
    }
    await ctx.reply(`You said: ${text}`);
  });

  bot.on("pre_checkout_query", async (ctx) => {
    const pq = ctx.preCheckoutQuery;
    if (pq.invoice_payload === "buy_stars_10" && pq.total_amount === 10) {
      await ctx.answerPreCheckoutQuery(true);
    } else {
      await ctx.answerPreCheckoutQuery(false, "Unsupported invoice");
    }
  });

  bot.on("message:successful_payment", async (ctx) => {
    const payment = ctx.message.successful_payment;
    if (payment.invoice_payload === "buy_stars_10") {
      const userId = String(ctx.from.id);
      const userDataStorage = getUserDataStorage();
      const current = (await userDataStorage.read(userId)) ?? { stars: 0, unlocked: false };
      const newBalance = current.stars + 10;
      const wasUnlocked = current.unlocked;
      await userDataStorage.write(userId, { stars: newBalance, unlocked: true });
      await ctx.reply(`Payment received! You now have ${newBalance} stars.`);
      if (!wasUnlocked) {
        await ctx.reply("Your account is now unlocked! 🎉");
      }

      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      if (adminChatId) {
        const username = ctx.from.username ? `@${ctx.from.username}` : "no username";
        await ctx.api.sendMessage(
          Number(adminChatId),
          `New purchase!\nUser: ${ctx.from.first_name} (ID: ${ctx.from.id}, ${username})\nTransaction: ${payment.telegram_payment_charge_id}`,
        );
      }
    }
  });

  bot.catch(async (err) => {
    try {
      await err.ctx.reply("Something went wrong. Please try again later.");
    } catch (_e) {
      // Best-effort reply — createBot's built-in catch already logs the error.
    }
  });

  return bot;
}
