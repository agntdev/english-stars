import { createBot, menuKeyboard, type InlineKeyboardMarkup } from "./toolkit/index.js";

// The per-chat session shape (ephemeral conversation state only). Extend as the
// bot grows. Durable domain data must NOT live here — use the toolkit's
// persistent storage (see AGENTS.md).
export interface Session {
  // example: step?: "awaiting_amount";
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

function parseAdminChatId(raw?: string): number | undefined {
  if (!raw) return undefined;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

/**
 * buildBot — assembles the bot and registers every handler, but does NOT start
 * it. Shared by the runtime entry (src/index.ts) and the Tests-gate harness
 * (src/harness-entry.ts) so both exercise the exact same bot. Add new commands
 * and flows here.
 *
 * @param adminChatId — Telegram chat id (usually numeric) where critical error
 *   notifications are sent. Read from TELEGRAM_ADMIN_CHAT_ID env at the call site.
 */
export function buildBot(token: string, adminChatId?: string) {
  const bot = createBot<Session>(token, {
    initial: () => ({}),
  });

  const adminId = parseAdminChatId(adminChatId);

  function notifyAdmin(text: string): void {
    if (adminId === undefined) return;
    bot.api.sendMessage(adminId, text).catch(() => {});
  }

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
    await ctx.reply("Use /lesson to start micro-lessons and build your vocabulary step by step.");
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
    const payload = ctx.preCheckoutQuery.invoice_payload;
    if (payload !== "buy_stars_10") {
      const errorMsg = `Unknown invoice payload: ${payload}`;
      notifyAdmin(`⚠️ Pre-checkout rejected: ${errorMsg}`);
      try {
        await ctx.answerPreCheckoutQuery(false, "Unknown payment type.");
      } catch { /* best-effort */ }
      return;
    }
    try {
      await ctx.answerPreCheckoutQuery(true);
    } catch (e) {
      notifyAdmin(`⚠️ Failed to answer pre_checkout_query: ${String(e)}`);
      try {
        await ctx.answerPreCheckoutQuery(false, "Internal error processing payment.");
      } catch { /* best-effort */ }
    }
  });

  bot.on("message:successful_payment", async (ctx) => {
    const payment = ctx.message.successful_payment;
    await ctx.reply("✅ Payment successful! Your 10 Stars have been added to your account.");
    notifyAdmin(
      `✅ Payment received: ${payment.total_amount} ${payment.currency} from user ${ctx.from?.id} (payload: ${payment.invoice_payload})`,
    );
  });

  bot.catch(async (err) => {
    notifyAdmin(`⚠️ Critical bot error: ${String(err.error)}`);
    try {
      await err.ctx.reply("Something went wrong. Please try again later.");
    } catch (_e) {
      // Best-effort reply — createBot's built-in catch already logs the error.
    }
  });

  return bot;
}
