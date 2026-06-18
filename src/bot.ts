import { createBot, inlineButton, inlineKeyboard, menuKeyboard, type InlineKeyboardMarkup } from "./toolkit/index.js";
import { getLocaleStorage, getUserDataStorage } from "./storage.js";

// The per-chat session shape (ephemeral conversation state only). Extend as the
// bot grows. Durable domain data must NOT live here — use the toolkit's
// persistent storage (see AGENTS.md).
export interface Session {
  lessonPage?: number;
  quizIndex?: number;
  quizScore?: number;
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

const KNOWN_COMMANDS = new Set(["start", "help", "buy", "lesson", "practice", "reminders", "stats", "locale"]);

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
  options: [string, string, string, string];
  correct: number;
}

const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    question: "What is the 'spacing effect' in learning?",
    options: [
      "Cramming all material in one sitting",
      "Spreading study sessions over time improves retention",
      "Adding extra spaces between words while reading",
      "Learning in a large physical space",
    ],
    correct: 1,
  },
  {
    question: "Which study technique has the strongest evidence for long-term retention?",
    options: [
      "Re-reading the textbook multiple times",
      "Highlighting key passages",
      "Active recall (self-testing)",
      "Listening to lectures while sleeping",
    ],
    correct: 2,
  },
  {
    question: "What is 'elaborative rehearsal'?",
    options: [
      "Repeating information aloud many times",
      "Connecting new information to what you already know",
      "Memorizing facts in alphabetical order",
      "Practicing a skill until exhaustion",
    ],
    correct: 1,
  },
  {
    question: "According to the Ebbinghaus forgetting curve, when is most information lost?",
    options: [
      "After one year",
      "After one month",
      "Within the first 24 hours",
      "Information is never truly lost",
    ],
    correct: 2,
  },
  {
    question: "What is 'interleaved practice'?",
    options: [
      "Practicing one skill until perfect, then moving on",
      "Mixing different topics or skills in a single study session",
      "Taking long breaks between every practice attempt",
      "Studying only on alternating days",
    ],
    correct: 1,
  },
  {
    question: "Which describes 'metacognition' in learning?",
    options: [
      "Learning through physical movement",
      "Awareness and understanding of one's own thought processes",
      "Studying in complete isolation",
      "Using flashcards exclusively",
    ],
    correct: 1,
  },
];

function quizMessage(index: number, q: QuizQuestion): string {
  return `❓ Question ${index + 1} of ${QUIZ_QUESTIONS.length}\n\n${q.question}`;
}

function quizKeyboard(index: number): InlineKeyboardMarkup {
  const q = QUIZ_QUESTIONS[index];
  return inlineKeyboard(
    q.options.map((opt, i) => [inlineButton(opt, `quiz:answer:${index}:${i}`)]),
  );
}

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
    ctx.session.quizIndex = 0;
    ctx.session.quizScore = 0;
    const q = QUIZ_QUESTIONS[0];
    await ctx.reply(quizMessage(0, q), { reply_markup: quizKeyboard(0) });
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

  bot.callbackQuery(/^quiz:answer:(\d+):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const qIndex = parseInt(ctx.match[1], 10);
    const aIndex = parseInt(ctx.match[2], 10);
    if (
      isNaN(qIndex) || isNaN(aIndex) ||
      ctx.session.quizIndex === undefined ||
      qIndex !== ctx.session.quizIndex ||
      qIndex >= QUIZ_QUESTIONS.length
    ) return;
    const q = QUIZ_QUESTIONS[qIndex];
    const correct = aIndex === q.correct;
    let score = ctx.session.quizScore ?? 0;
    if (correct) score++;
    ctx.session.quizScore = score;
    const nextIndex = qIndex + 1;
    if (nextIndex < QUIZ_QUESTIONS.length) {
      ctx.session.quizIndex = nextIndex;
      const nextQ = QUIZ_QUESTIONS[nextIndex];
      const feedback = correct
        ? `✅ Correct! (${score}/${nextIndex})\n\n`
        : `❌ Wrong. The correct answer was: "${q.options[q.correct]}".\n\n`;
      await ctx.reply(feedback + quizMessage(nextIndex, nextQ), { reply_markup: quizKeyboard(nextIndex) });
    } else {
      ctx.session.quizIndex = undefined;
      ctx.session.quizScore = undefined;
      const total = QUIZ_QUESTIONS.length;
      const pct = Math.round((score / total) * 100);
      let grade: string;
      if (pct === 100) grade = "🏆 Perfect score!";
      else if (pct >= 80) grade = "🌟 Great job!";
      else if (pct >= 60) grade = "👍 Good effort!";
      else grade = "📚 Keep practicing!";
      const feedback = correct
        ? `✅ Correct!\n\n`
        : `❌ Wrong. The correct answer was: "${q.options[q.correct]}".\n\n`;
      await ctx.reply(
        `${feedback}🎯 Quiz complete!\n\nScore: ${score}/${total} (${pct}%)\n${grade}`,
      );
    }
  });

  bot.callbackQuery("menu:help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Available commands:\n/start — Main menu\n/buy — Buy Stars\n/lesson — Micro-lessons\n/practice — Practice quizzes\n/reminders — Daily reminders\n/stats — View your stats\n/locale — Set language\n/help — Show this help");
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
    ctx.session.quizIndex = 0;
    ctx.session.quizScore = 0;
    const q = QUIZ_QUESTIONS[0];
    await ctx.reply(quizMessage(0, q), { reply_markup: quizKeyboard(0) });
  });

  bot.callbackQuery("menu:reminders", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Use /reminders to set up daily practice reminders at your preferred time.");
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
