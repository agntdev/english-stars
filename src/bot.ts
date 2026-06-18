import { createBot, inlineButton, inlineKeyboard, menuKeyboard, urlButton, type InlineButton, type InlineKeyboardMarkup } from "./toolkit/index.js";
import { getLocaleStorage, getUserDataStorage } from "./storage.js";

// The per-chat session shape (ephemeral conversation state only). Extend as the
// bot grows. Durable domain data must NOT live here — use the toolkit's
// persistent storage (see AGENTS.md).
export interface Session {
  lessonPage?: number;
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

interface WordCard {
  word: string;
  partOfSpeech: string;
  definition: string;
  example: string;
}

const WORD_DECK: readonly WordCard[] = [
  { word: "Ephemeral", partOfSpeech: "adjective", definition: "Lasting for a very short time.", example: "The beauty of cherry blossoms is ephemeral." },
  { word: "Ubiquitous", partOfSpeech: "adjective", definition: "Present, appearing, or found everywhere.", example: "Smartphones have become ubiquitous in modern life." },
  { word: "Pragmatic", partOfSpeech: "adjective", definition: "Dealing with things sensibly and realistically.", example: "We need a pragmatic approach to this problem." },
  { word: "Eloquent", partOfSpeech: "adjective", definition: "Fluent or persuasive in speaking or writing.", example: "She gave an eloquent speech about climate change." },
  { word: "Resilient", partOfSpeech: "adjective", definition: "Able to withstand or recover quickly from difficult conditions.", example: "Children are remarkably resilient." },
  { word: "Ambiguous", partOfSpeech: "adjective", definition: "Open to more than one interpretation.", example: "His answer was deliberately ambiguous." },
  { word: "Meticulous", partOfSpeech: "adjective", definition: "Showing great attention to detail.", example: "She is a meticulous researcher." },
  { word: "Inevitable", partOfSpeech: "adjective", definition: "Certain to happen; unavoidable.", example: "Change is inevitable in life." },
  { word: "Benevolent", partOfSpeech: "adjective", definition: "Well-meaning and kindly.", example: "The benevolent donor funded the new library." },
  { word: "Candid", partOfSpeech: "adjective", definition: "Truthful and straightforward; frank.", example: "I appreciate your candid feedback." },
  { word: "Diligent", partOfSpeech: "adjective", definition: "Having or showing care in one's work.", example: "A diligent student prepares for every class." },
  { word: "Verbose", partOfSpeech: "adjective", definition: "Using more words than needed.", example: "His verbose explanation confused everyone." },
  { word: "Tenacious", partOfSpeech: "adjective", definition: "Tending to keep a firm hold of something.", example: "The tenacious reporter pursued the story." },
  { word: "Mundane", partOfSpeech: "adjective", definition: "Lacking interest or excitement; dull.", example: "She wanted to escape the mundane routine." },
  { word: "Amiable", partOfSpeech: "adjective", definition: "Having a friendly and pleasant manner.", example: "The amiable host made everyone feel welcome." },
  { word: "Skeptical", partOfSpeech: "adjective", definition: "Not easily convinced; having doubts.", example: "I am skeptical about that claim." },
  { word: "Prolific", partOfSpeech: "adjective", definition: "Producing much fruit or many works.", example: "She was a prolific writer of short stories." },
  { word: "Conspicuous", partOfSpeech: "adjective", definition: "Standing out so as to be clearly visible.", example: "His absence was conspicuous." },
  { word: "Gregarious", partOfSpeech: "adjective", definition: "Fond of company; sociable.", example: "He was a gregarious person who loved parties." },
  { word: "Voracious", partOfSpeech: "adjective", definition: "Wanting or devouring great quantities.", example: "She had a voracious appetite for books." },
];

function lessonMessage(page: number): string {
  const card = WORD_DECK[page];
  const lines = [
    `📖 Word ${page + 1} of ${WORD_DECK.length}`,
    "",
    `${card.word} (${card.partOfSpeech})`,
    `📘 ${card.definition}`,
    `💬 "${card.example}"`,
  ];
  return lines.join("\n");
}

function lessonKeyboard(page: number): InlineKeyboardMarkup {
  const total = WORD_DECK.length;
  const card = WORD_DECK[page];
  const encodedWord = encodeURIComponent(card.word);
  const rows: InlineButton[][] = [];
  rows.push([urlButton("🔈 Play audio", `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodedWord}`)]);
  const navRow: InlineButton[] = [];
  if (page > 0) {
    navRow.push(inlineButton("← Prev", `lesson:prev:${page - 1}`));
  }
  if (page < total - 1) {
    navRow.push(inlineButton("Next →", `lesson:next:${page + 1}`));
  }
  if (navRow.length > 0) {
    rows.push(navRow);
  }
  return inlineKeyboard(rows);
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
    if (isNaN(page) || page < 0 || page >= WORD_DECK.length) return;
    ctx.session.lessonPage = page;
    await ctx.editMessageText(lessonMessage(page), { reply_markup: lessonKeyboard(page) });
  });

  bot.callbackQuery("menu:practice", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Use /practice to test your knowledge with interactive quizzes.");
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
