import { createBot, inlineButton, inlineKeyboard, menuKeyboard, type InlineButton, type InlineKeyboardMarkup } from "./toolkit/index.js";
import { getLocaleStorage, getReminderStorage, getStatsStorage, getUserDataStorage, incrementStat, recordActiveUser, saveQuizScore } from "./storage.js";
import { scheduleReminder, cancelReminder } from "./reminder.js";
import { generateTypeWordQuiz, checkTypeWordAnswer } from "./quiz.js";
import { WORD_CARDS, wordCardMessage, wordCardKeyboard } from "./wordcard.js";

// The per-chat session shape (ephemeral conversation state only). Extend as the
// bot grows. Durable domain data must NOT live here — use the toolkit's
// persistent storage (see AGENTS.md).
export interface Session {
  lessonPage?: number;
  awaitingReminderTime?: boolean;
  reminderCadence?: "daily" | "every_other_day";
  quizQuestion?: number;
  quizScore?: number;
  typeWordQuestion?: number;
  typeWordScore?: number;
  adminAction?: "grant" | "refund";
  adminTargetUserId?: string;
  wordCardPage?: number;
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

const KNOWN_COMMANDS = new Set(["start", "help", "buy", "lesson", "practice", "reminders", "reminderoff", "stats", "locale", "typeword", "admin", "wordcard"]);

async function notifyAdmin(bot: ReturnType<typeof createBot<Session>>, message: string) {
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (adminChatId) {
    try {
      await bot.api.sendMessage(Number(adminChatId), message, { disable_notification: false });
    } catch (_e) {
      console.error("[agntdev-bot] failed to send admin notification:", _e);
    }
  }
}

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

interface QuizQuestion {
  text: string;
  options: string[];
  correct: number;
}

const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    text: "According to Micro-Lesson 1, what improves your skills quickly?",
    options: ["Daily practice", "Watching videos", "Reading books"],
    correct: 0,
  },
  {
    text: "What leads to mastery according to Micro-Lesson 2?",
    options: ["Big breakthroughs", "Small steps", "Working alone"],
    correct: 1,
  },
  {
    text: "How often should you review past lessons?",
    options: ["Every day", "Every week", "Every month"],
    correct: 1,
  },
  {
    text: "What beats intensity every time?",
    options: ["Speed", "Consistency", "Motivation"],
    correct: 1,
  },
];

function quizMessage(questionIndex: number): string {
  const q = QUIZ_QUESTIONS[questionIndex];
  return `📝 Quiz — Question ${questionIndex + 1} of ${QUIZ_QUESTIONS.length}\n\n${q.text}`;
}

function quizKeyboard(questionIndex: number): InlineKeyboardMarkup {
  const q = QUIZ_QUESTIONS[questionIndex];
  const rows: InlineButton[][] = q.options.map((opt, i) =>
    [inlineButton(opt, `practice:answer:${questionIndex}:${i}`)]
  );
  return inlineKeyboard(rows);
}

function startQuiz(ctx: { session: Session; reply: (...args: any[]) => any }) {
  ctx.session.quizQuestion = 0;
  ctx.session.quizScore = 0;
  return ctx.reply(quizMessage(0), { reply_markup: quizKeyboard(0) });
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
    await incrementStat("global", "totalStarts");
    if (ctx.from) await recordActiveUser(String(ctx.from.id));
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "Available commands:\n" +
      "/start — Main menu\n" +
      "/buy — Buy Stars\n" +
      "/lesson — Micro-lessons\n" +
      "/practice — Multiple-choice quizzes\n" +
      "/typeword — Type-the-word quizzes\n" +
      "/wordcard — Browse word cards\n" +
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

  bot.command("practice", async (ctx) => {
    await startQuiz(ctx);
  });

  bot.command("typeword", async (ctx) => {
    const questions = generateTypeWordQuiz(MICRO_LESSONS);
    if (questions.length === 0) {
      await ctx.reply("No type-the-word questions available right now.");
      return;
    }
    ctx.session.typeWordQuestion = 0;
    ctx.session.typeWordScore = 0;
    const q = questions[0];
    await ctx.reply(
      `⌨️ Type the Word — Question 1 of ${questions.length}\n\n${q.text}\n\nType your answer below:`,
    );
  });

  bot.command("wordcard", async (ctx) => {
    ctx.session.wordCardPage = 0;
    await ctx.reply(wordCardMessage(0), { reply_markup: wordCardKeyboard(0) });
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

    if (current?.cadence === "off") {
      await ctx.reply(
        "Reminders are currently turned off.",
        {
          reply_markup: inlineKeyboard([
            [inlineButton("Daily", "reminders:cadence:daily")],
            [inlineButton("Every other day", "reminders:cadence:every_other_day")],
          ]),
        },
      );
      return;
    }

    const currentTime = current?.time ?? "09:00";
    const currentCadence = current?.cadence ?? "daily";
    const defaultNote = current ? "" : " (default)";
    const cadenceLabel = currentCadence === "every_other_day" ? "every-other-day" : "daily";
    ctx.session.reminderCadence = currentCadence as "daily" | "every_other_day";
    ctx.session.awaitingReminderTime = true;
    await ctx.reply(
      `Your ${cadenceLabel} reminder time: ${currentTime}${defaultNote}\n\nSend your preferred time in 24-hour HH:MM format (e.g., 14:30).`,
      {
        reply_markup: inlineKeyboard([
          [inlineButton("Daily", "reminders:cadence:daily")],
          [inlineButton("Every other day", "reminders:cadence:every_other_day")],
          [inlineButton("Off", "reminders:cadence:off")],
        ]),
      },
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

  bot.command("stats", async (ctx) => {
    if (!ctx.from) return;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (adminChatId && String(ctx.from.id) === adminChatId) {
      const statsStorage = getStatsStorage();
      const stats = (await statsStorage.read("global")) ?? { totalStarts: 0, totalSales: 0, activeUsers: 0 };
      await ctx.reply(
        "📊 Admin Stats\n\n" +
        `👤 Active users: ${stats.activeUsers}\n` +
        `👥 Total /start invocations: ${stats.totalStarts}\n` +
        `💰 Total sales: ${stats.totalSales}`,
      );
      return;
    }
    const userId = String(ctx.from.id);
    const userDataStorage = getUserDataStorage();
    const data = (await userDataStorage.read(userId)) ?? { stars: 0, unlocked: false };
    await ctx.reply(
      "📊 Your Stats\n\n" +
      `⭐ Stars: ${data.stars}\n` +
      `🔒 Account: ${data.unlocked ? "Unlocked ✅" : "Not unlocked"}\n\n` +
      "Use /buy to purchase stars and unlock your account.",
    );
  });

  bot.command("admin", async (ctx) => {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!adminChatId || !ctx.from || String(ctx.from.id) !== adminChatId) {
      await ctx.reply("You are not authorized to use admin commands.");
      return;
    }
    const ADMIN_MENU_KEYBOARD: InlineKeyboardMarkup = inlineKeyboard([
      [inlineButton("🔓 Grant Access", "admin:grant")],
      [inlineButton("💸 Process Refund", "admin:refund")],
    ]);
    await ctx.reply("🔧 Admin Panel\n\nChoose an action:", { reply_markup: ADMIN_MENU_KEYBOARD });
  });

  bot.callbackQuery("admin:grant", async (ctx) => {
    await ctx.answerCallbackQuery();
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!adminChatId || !ctx.from || String(ctx.from.id) !== adminChatId) {
      await ctx.reply("You are not authorized.");
      return;
    }
    ctx.session.adminAction = "grant";
    ctx.session.adminTargetUserId = undefined;
    await ctx.reply("Send the user ID to grant access to:");
  });

  bot.callbackQuery("admin:refund", async (ctx) => {
    await ctx.answerCallbackQuery();
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!adminChatId || !ctx.from || String(ctx.from.id) !== adminChatId) {
      await ctx.reply("You are not authorized.");
      return;
    }
    ctx.session.adminAction = "refund";
    ctx.session.adminTargetUserId = undefined;
    await ctx.reply("Send the user ID to process a refund for:");
  });

  bot.callbackQuery("menu:help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Available commands:\n/start — Main menu\n/buy — Buy Stars\n/lesson — Micro-lessons\n/practice — Multiple-choice quizzes\n/typeword — Type-the-word quizzes\n/wordcard — Browse word cards\n/reminders — Daily reminders\n/reminderoff — Turn off reminders\n/stats — View your stats\n/locale — Set language\n/help — Show this help");
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

  bot.callbackQuery(/^wordcard:(next|prev):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const page = parseInt(ctx.match[2], 10);
    if (isNaN(page) || page < 0 || page >= WORD_CARDS.length) return;
    ctx.session.wordCardPage = page;
    await ctx.editMessageText(wordCardMessage(page), { reply_markup: wordCardKeyboard(page) });
  });

  bot.callbackQuery(/^wordcard:play:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const page = parseInt(ctx.match[1], 10);
    if (isNaN(page) || page < 0 || page >= WORD_CARDS.length) return;
    const card = WORD_CARDS[page];
    if (card.word) {
      await ctx.reply(`“${card.word}” — ${card.definition}`);
    }
  });

  bot.callbackQuery(/^practice:answer:(\d+):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const questionIndex = parseInt(ctx.match[1], 10);
    const choiceIndex = parseInt(ctx.match[2], 10);
    if (isNaN(questionIndex) || isNaN(choiceIndex)) return;
    if (questionIndex !== ctx.session.quizQuestion) return;
    if (questionIndex >= QUIZ_QUESTIONS.length) return;

    const q = QUIZ_QUESTIONS[questionIndex];
    const correct = choiceIndex === q.correct;
    if (correct) {
      ctx.session.quizScore = (ctx.session.quizScore ?? 0) + 1;
    }

    const feedback = correct
      ? "✅ Correct!"
      : `❌ Incorrect. The correct answer was: ${q.options[q.correct]}`;
    await ctx.editMessageText(
      `${quizMessage(questionIndex)}\n\n${feedback}`,
    );

    const nextIndex = questionIndex + 1;
    if (nextIndex < QUIZ_QUESTIONS.length) {
      ctx.session.quizQuestion = nextIndex;
      await ctx.reply(quizMessage(nextIndex), { reply_markup: quizKeyboard(nextIndex) });
    } else {
      const score = ctx.session.quizScore ?? 0;
      const total = QUIZ_QUESTIONS.length;
      const userId = ctx.from ? String(ctx.from.id) : "unknown";
      await saveQuizScore(userId, "practice", score, total);
      await ctx.reply(`🎉 Quiz complete! You scored ${score}/${total}.`);
      ctx.session.quizQuestion = undefined;
      ctx.session.quizScore = undefined;
    }
  });

  bot.callbackQuery("menu:practice", async (ctx) => {
    await ctx.answerCallbackQuery();
    await startQuiz(ctx);
  });

  bot.callbackQuery("menu:reminders", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Use /reminders to set up daily practice reminders at your preferred time. Use /reminderoff to disable them.");
  });

  bot.callbackQuery(/^reminders:cadence:(daily|every_other_day|off)$/, async (ctx) => {
    const cadence = ctx.match[1];
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    const userId = String(ctx.from.id);
    const reminderStorage = getReminderStorage();

    if (cadence === "off") {
      const current = await reminderStorage.read(userId);
      if (current) {
        await cancelReminder(userId);
      }
      await reminderStorage.write(userId, { time: current?.time ?? "09:00", cadence: "off" });
      ctx.session.awaitingReminderTime = false;
      await ctx.reply("Daily reminders turned off. Send /reminders to schedule again.");
      return;
    }

    ctx.session.reminderCadence = cadence as "daily" | "every_other_day";
    ctx.session.awaitingReminderTime = true;
    const current = await reminderStorage.read(userId);
    const currentTime = current?.time ?? "09:00";
    const cadenceLabel = cadence === "every_other_day" ? "every-other-day" : "daily";
    await ctx.reply(
      `Your ${cadenceLabel} reminder time: ${currentTime}\n\nSend your preferred time in 24-hour HH:MM format (e.g., 14:30).`,
    );
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
    if (ctx.session.adminAction && ctx.from) {
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      if (adminChatId && String(ctx.from.id) === adminChatId) {
        const targetId = ctx.session.adminTargetUserId;
        if (ctx.session.adminAction === "grant") {
          if (!targetId) {
            const userId = text.trim();
            if (!/^\d+$/.test(userId)) {
              await ctx.reply("Invalid user ID. Please send a numeric user ID.");
              return;
            }
            const userDataStorage = getUserDataStorage();
            const data = await userDataStorage.read(userId);
            if (!data) {
              await ctx.reply(`User ${userId} not found.`);
              ctx.session.adminAction = undefined;
              return;
            }
            if (data.unlocked) {
              await ctx.reply(`User ${userId} already has access.`);
              ctx.session.adminAction = undefined;
              return;
            }
            await userDataStorage.write(userId, { stars: data.stars, unlocked: true });
            await ctx.reply(`Access granted to user ${userId}.`);
            ctx.session.adminAction = undefined;
            return;
          }
        }
        if (ctx.session.adminAction === "refund") {
          if (!targetId) {
            const userId = text.trim();
            if (!/^\d+$/.test(userId)) {
              await ctx.reply("Invalid user ID. Please send a numeric user ID.");
              return;
            }
            const userDataStorage = getUserDataStorage();
            const data = await userDataStorage.read(userId);
            if (!data) {
              await ctx.reply(`User ${userId} not found.`);
              ctx.session.adminAction = undefined;
              return;
            }
            ctx.session.adminTargetUserId = userId;
            await ctx.reply(`Send the number of stars to refund from user ${userId}:`);
            return;
          } else {
            const amount = parseInt(text.trim(), 10);
            if (isNaN(amount) || amount <= 0) {
              await ctx.reply("Invalid amount. Please send a positive number of stars.");
              return;
            }
            const userDataStorage = getUserDataStorage();
            const data = await userDataStorage.read(targetId);
            if (!data) {
              await ctx.reply(`User ${targetId} not found.`);
              ctx.session.adminAction = undefined;
              ctx.session.adminTargetUserId = undefined;
              return;
            }
            const newBalance = Math.max(0, data.stars - amount);
            await userDataStorage.write(targetId, { stars: newBalance, unlocked: data.unlocked });
            await ctx.reply(`Refunded ${amount} stars from user ${targetId}. New balance: ${newBalance} stars.`);
            ctx.session.adminAction = undefined;
            ctx.session.adminTargetUserId = undefined;
            return;
          }
        }
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
        const cadence = ctx.session.reminderCadence ?? "daily";
        ctx.session.reminderCadence = undefined;
        const reminderStorage = getReminderStorage();
        await scheduleReminder(userId, time, cadence);
        try {
          await reminderStorage.write(userId, { time, cadence });
        } catch (e) {
          await cancelReminder(userId);
          throw e;
        }
        const cadenceLabel = cadence === "every_other_day" ? " (every-other-day)" : "";
        await ctx.reply(`Reminder time set to ${time}${cadenceLabel}.`);
      } else {
        await ctx.reply(`"${text}" is not a valid 24-hour time (HH:MM). Send /reminders to try again.`);
      }
      return;
    }
    if (ctx.session.typeWordQuestion !== undefined) {
      const questions = generateTypeWordQuiz(MICRO_LESSONS);
      const idx = ctx.session.typeWordQuestion;
      if (idx >= questions.length) return;
      const q = questions[idx];
      const correct = checkTypeWordAnswer(q, text);
      if (correct) {
        ctx.session.typeWordScore = (ctx.session.typeWordScore ?? 0) + 1;
      }
      const expected = q.answers.join(" / ");
      const feedback = correct
        ? "✅ Correct!"
        : `❌ Incorrect. The correct answer was: ${expected}`;
      await ctx.reply(
        `⌨️ Type the Word — Question ${idx + 1} of ${questions.length}\n\n${q.text}\n\nYour answer: ${text}\n\n${feedback}`,
      );
      const nextIdx = idx + 1;
      if (nextIdx < questions.length) {
        ctx.session.typeWordQuestion = nextIdx;
        const nq = questions[nextIdx];
        await ctx.reply(
          `⌨️ Type the Word — Question ${nextIdx + 1} of ${questions.length}\n\n${nq.text}\n\nType your answer below:`,
        );
      } else {
        const score = ctx.session.typeWordScore ?? 0;
        const total = questions.length;
        const userId = ctx.from ? String(ctx.from.id) : "unknown";
        await saveQuizScore(userId, "typeword", score, total);
        await ctx.reply(`🎉 Type-the-word quiz complete! You scored ${score}/${total}.`);
        ctx.session.typeWordQuestion = undefined;
        ctx.session.typeWordScore = undefined;
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
      const userInfo = ctx.preCheckoutQuery.from
        ? `${ctx.preCheckoutQuery.from.first_name} (ID: ${ctx.preCheckoutQuery.from.id})`
        : "unknown user";
      await notifyAdmin(
        bot,
        `⚠️ Payment rejected\n` +
          `User: ${userInfo}\n` +
          `Invoice: ${pq.invoice_payload}\n` +
          `Amount: ${pq.total_amount} ${pq.currency}\n` +
          `Reason: Unsupported invoice`,
      );
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

      await incrementStat("global", "totalSales");

      const username = ctx.from.username ? `@${ctx.from.username}` : "no username";
      await notifyAdmin(
        bot,
        `New purchase!\nUser: ${ctx.from.first_name} (ID: ${ctx.from.id}, ${username})\nTransaction: ${payment.telegram_payment_charge_id}`,
      );
    }
  });

  bot.catch(async (err) => {
    try {
      await err.ctx.reply("Something went wrong. Please try again later.");
    } catch (_e) {
      // Best-effort reply — createBot's built-in catch already logs the error.
    }
    const errorMsg = err.error instanceof Error ? err.error.message : String(err.error);
    const chatInfo = err.ctx.chat ? `Chat: ${err.ctx.chat.id}` : "Chat: unknown";
    const userInfo = err.ctx.from
      ? `User: ${err.ctx.from.first_name} (ID: ${err.ctx.from.id})`
      : "User: unknown";
    await notifyAdmin(
      bot,
      `🚨 Critical error in bot\n` +
        `Error: ${errorMsg}\n` +
        `${chatInfo}\n` +
        `${userInfo}`,
    );
  });

  return bot;
}
