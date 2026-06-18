import { createBot, menuKeyboard, inlineKeyboard, inlineButton, type InlineKeyboardMarkup } from "./toolkit/index.js";
import { getUserDataStorage } from "./storage.js";
import { buildLessonCards, type LessonCard } from "./vocabulary.js";

export interface LessonState {
  cards: LessonCard[];
  index: number;
  score: number;
}

// The per-chat session shape (ephemeral conversation state only). Extend as the
// bot grows. Durable domain data must NOT live here — use the toolkit's
// persistent storage (see AGENTS.md).
export interface Session {
  lesson?: LessonState;
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
    const cards = buildLessonCards();
    ctx.session.lesson = { cards, index: 0, score: 0 };
    const card = cards[0];
    const keyboard = inlineKeyboard(
      card.options.map((opt, i) => [inlineButton(opt, `lesson:answer:${i}`)]),
    );
    await ctx.reply(
      `📚 Micro-Lesson\n\nQuestion 1/${cards.length}: What does **${card.word}** mean?`,
      { parse_mode: "Markdown", reply_markup: keyboard },
    );
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
    const cards = buildLessonCards();
    ctx.session.lesson = { cards, index: 0, score: 0 };
    const card = cards[0];
    const keyboard = inlineKeyboard(
      card.options.map((opt, i) => [inlineButton(opt, `lesson:answer:${i}`)]),
    );
    await ctx.reply(
      `📚 Micro-Lesson\n\nQuestion 1/${cards.length}: What does **${card.word}** mean?`,
      { parse_mode: "Markdown", reply_markup: keyboard },
    );
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

  bot.on("callback_query:data", async (ctx) => {
    if (!ctx.callbackQuery.data) return;

    if (ctx.callbackQuery.data.startsWith("lesson:answer:")) {
      const sess = ctx.session.lesson;
      if (!sess) {
        await ctx.answerCallbackQuery({ text: "No active lesson. Use /lesson to start." });
        return;
      }
      if (sess.index >= sess.cards.length) {
        await ctx.answerCallbackQuery({ text: "Lesson already complete." });
        return;
      }

      const answerIdx = Number(ctx.callbackQuery.data.split(":")[2]);
      const card = sess.cards[sess.index];
      const chosen = card.options[answerIdx];
      const isCorrect = chosen === card.correct;

      await ctx.answerCallbackQuery({ text: isCorrect ? "Correct!" : "Wrong!" });

      if (isCorrect) {
        sess.score++;
      }

      let feedback = isCorrect
        ? `✅ Correct!`
        : `❌ Wrong! **${card.word}** means: ${card.correct}`;

      sess.index++;
      const remaining = sess.cards.length - sess.index;

      if (remaining > 0) {
        const next = sess.cards[sess.index];
        const nextKeyboard = inlineKeyboard(
          next.options.map((opt, i) => [inlineButton(opt, `lesson:answer:${i}`)]),
        );
        await ctx.reply(
          `${feedback}\n\nQuestion ${sess.index + 1}/${sess.cards.length}: What does **${next.word}** mean?`,
          { parse_mode: "Markdown", reply_markup: nextKeyboard },
        );
      } else {
        const total = sess.cards.length;
        await ctx.reply(
          `${feedback}\n\n📚 **Lesson Complete!**\n\nScore: ${sess.score}/${total}`,
          { parse_mode: "Markdown" },
        );
        delete ctx.session.lesson;
      }
      return;
    }

    await ctx.answerCallbackQuery({ text: "Unknown action." });
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
