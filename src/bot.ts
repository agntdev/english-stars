import { createBot, menuKeyboard, inlineButton, inlineKeyboard, type InlineKeyboardMarkup } from "./toolkit/index.js";
import { getUserDataStorage, getQuizResultsStorage } from "./storage.js";

// The per-chat session shape (ephemeral conversation state only). Extend as the
// bot grows. Durable domain data must NOT live here — use the toolkit's
// persistent storage (see AGENTS.md).
export interface Session {
  lessonPage?: number;
  quizIndex?: number;
  quizScore?: number;
  quizTotal?: number;
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

const KNOWN_COMMANDS = new Set(["start", "help", "buy", "lesson", "practice", "reminders", "stats"]);

function welcomeText(): string {
  return "Welcome to AGNTDEV! 🎉\n\nI'm your learning companion. Choose an option below to get started:";
}

const MICRO_LESSONS: readonly string[] = [
  "Practice daily to improve quickly.",
  "Small steps lead to mastery.",
  "Review past lessons every week.",
  "Consistency beats intensity every time.",
];

interface QuizQuestion {
  question: string;
  options: readonly string[];
  correctIndex: number;
}

const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    question: "What should you do daily to improve quickly?",
    options: ["Skip practice", "Practice daily", "Study once a month", "Wait for motivation"],
    correctIndex: 1,
  },
  {
    question: "According to the lessons, what leads to mastery?",
    options: ["Big leaps", "Natural talent", "Small steps", "Studying all night"],
    correctIndex: 2,
  },
  {
    question: "How often should you review past lessons?",
    options: ["Every week", "Every month", "Every year", "Only when stuck"],
    correctIndex: 0,
  },
  {
    question: "What beats intensity every time?",
    options: ["Speed", "Natural ability", "Consistency", "Cramming"],
    correctIndex: 2,
  },
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

function quizQuestionMessage(index: number): string {
  const q = QUIZ_QUESTIONS[index];
  const total = QUIZ_QUESTIONS.length;
  return `🎯 Practice Quiz — Question ${index + 1} of ${total}\n\n${q.question}`;
}

function quizAnswerKeyboard(index: number): InlineKeyboardMarkup {
  const q = QUIZ_QUESTIONS[index];
  const buttons = q.options.map((text, ai) =>
    inlineButton(text, `practice:answer:${index}:${ai}`),
  );
  return inlineKeyboard(buttons.map((b) => [b]));
}

function quizResultMessage(score: number, total: number): string {
  const pct = Math.round((score / total) * 100);
  return (
    `🎯 Quiz Complete!\n\n` +
    `Score: ${score}/${total} (${pct}%)\n\n` +
    (pct === 100
      ? "Perfect score! 🏆"
      : pct >= 75
        ? "Great job! 🌟"
        : pct >= 50
          ? "Good effort! Keep practicing. 💪"
          : "Keep studying and try again! 📚")
  );
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
      "/stats — View your stats\n" +
      "/help — Show this help"
    );
  });

  bot.command("lesson", async (ctx) => {
    ctx.session.lessonPage = 0;
    await ctx.reply(lessonMessage(0), { reply_markup: lessonKeyboard(0) });
  });

  bot.command("practice", async (ctx) => {
    ctx.session.quizIndex = 0;
    ctx.session.quizScore = 0;
    ctx.session.quizTotal = QUIZ_QUESTIONS.length;
    await ctx.reply(quizQuestionMessage(0), { reply_markup: quizAnswerKeyboard(0) });
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

  bot.callbackQuery("menu:help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Available commands:\n/start — Main menu\n/buy — Buy Stars\n/lesson — Micro-lessons\n/practice — Practice quizzes\n/reminders — Daily reminders\n/stats — View your stats\n/help — Show this help");
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

  bot.callbackQuery(/^practice:answer:(\d+):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const qi = parseInt(ctx.match[1], 10);
    const ai = parseInt(ctx.match[2], 10);
    if (
      isNaN(qi) || isNaN(ai) ||
      qi !== (ctx.session.quizIndex ?? -1) ||
      qi < 0 || qi >= QUIZ_QUESTIONS.length
    ) return;

    const q = QUIZ_QUESTIONS[qi];
    const correct = ai === q.correctIndex;
    if (correct) {
      ctx.session.quizScore = (ctx.session.quizScore ?? 0) + 1;
    }

    const total = ctx.session.quizTotal ?? QUIZ_QUESTIONS.length;
    const nextIndex = qi + 1;

    if (nextIndex < total) {
      ctx.session.quizIndex = nextIndex;
      const correctText = correct
        ? "✅ Correct!"
        : `❌ Incorrect. The right answer was: ${q.options[q.correctIndex]}`;
      await ctx.editMessageText(
        `${correctText}\n\n${quizQuestionMessage(nextIndex)}`,
        { reply_markup: quizAnswerKeyboard(nextIndex) },
      );
    } else {
      const score = ctx.session.quizScore ?? 0;
      ctx.session.quizIndex = undefined;
      ctx.session.quizScore = undefined;
      ctx.session.quizTotal = undefined;
      const userId = String(ctx.from.id);
      const storage = getQuizResultsStorage();
      const prev = (await storage.read(userId)) ?? [];
      prev.push({ quizId: `practice-${Date.now()}`, score, total, completedAt: Date.now() });
      await storage.write(userId, prev);
      const correctText = correct
        ? "✅ Correct!"
        : `❌ Incorrect. The right answer was: ${q.options[q.correctIndex]}`;
      await ctx.editMessageText(
        `${correctText}\n\n${quizResultMessage(score, total)}`,
      );
    }
  });

  bot.callbackQuery("menu:practice", async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.quizIndex = 0;
    ctx.session.quizScore = 0;
    ctx.session.quizTotal = QUIZ_QUESTIONS.length;
    await ctx.reply(quizQuestionMessage(0), { reply_markup: quizAnswerKeyboard(0) });
  });

  bot.callbackQuery("menu:reminders", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Use /reminders to set up daily practice reminders at your preferred time.");
  });

  bot.callbackQuery("menu:stats", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Use /stats to view your learning progress and activity.");
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
