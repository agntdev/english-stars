# English Stars — Telegram Vocabulary Bot

## Summary
A Telegram bot that sells a one-time "10 stars" access package which unlocks an English vocabulary learning course plus configurable daily reminders. Users buy access inside Telegram, receive an initial deck of words, practice via short micro-lessons and quizzes, and get scheduled reminder notifications.

## Audience
- Casual English learners who want daily micro-lessons and reminders delivered in Telegram.
- Non-technical owner who will receive admin notifications when purchases or issues occur.

## Core entities
- User: Telegram user id, name, language (locale), time zone, reminder settings, access status, last activity, purchased packages.
- Package/Access: represents the purchased "10 stars" purchase that unlocks course content.
- Lesson / Word item: word, part of speech, definitions, example sentence, phonetic, TTS audio URI, difficulty tag, deck id.
- Deck: group of words (initial deck, review decks, custom decks).
- Session: a learning/practice session record (user, deck, score, timestamp).
- Reminder job: scheduled notification entries (user id, cadence, next_run, enabled).
- Transaction: payment invoice, status, amount, provider id.

## Integrations & notification targets
- Telegram Bot API (primary UI) for messages, inline keyboards, and receiving commands.
- Telegram Payments for one-time purchase of the "10 stars" package (invoices delivered by bot).
- Text-to-Speech (TTS) provider: Google Cloud TTS by default (fallback to gTTS library if unavailable) to generate audio for words.
- Database: PostgreSQL for persistent data (users, words, transactions, reminders, sessions).
- Redis (or equivalent) for job queue and short-term caching.
- Job worker: Celery (Python) or Bull (Node) to schedule reminders and background tasks (TTS generation, sending reminders).
- Admin notifications: a configurable TELEGRAM_ADMIN_CHAT_ID receives purchase and error notifications.

## Interaction flows
1. /start
   - Show welcome, short explanation, price and a Buy button.
   - If user already purchased, show quick actions: Start lesson, Practice, Reminders.
2. Purchase flow
   - User taps Buy -> create Telegram invoice for "10 stars" package -> on successful payment mark user as unlocked and send initial deck.
   - Send admin notification with user info and transaction id.
3. Onboarding after purchase
   - Deliver initial deck (default: 20 words) as a guided mini-course: 5 words per micro-lesson, 4 micro-lessons delivered immediately with spacing OR allow user to request lessons on demand.
   - Prompt user to set preferred daily reminder time (default provided) and language/locale.
4. Lesson flow
   - Each lesson shows a word card (word, part of speech, definition, example, Play audio, buttons: Know / Need Practice).
   - If user taps Need Practice, schedule extra review and run a short quiz (multiple choice or type-the-word).
   - Use spaced repetition tags to schedule reviews.
5. Practice / Quiz
   - Quick quizzes (3–5 questions) using multiple-choice or input; immediate feedback and score stored.
6. Reminders
   - Daily reminder message at user-chosen time (default 09:00 local). Reminder opens directly into the day's micro-lesson.
   - Users can change cadence (/reminders) to daily, every-other-day, or off.
7. Admin & Support
   - /stats command available to owner (admin) to see active users, sales count, and basic metrics.
   - Error notifications and failed payments sent to TELEGRAM_ADMIN_CHAT_ID.

## Persistence
- PostgreSQL schema (tables): users, packages, words, decks, sessions, reminders, transactions, settings.
- Redis for scheduled job queue, short-lived tokens, and rate-limiting.
- TTS audio stored on cloud storage (e.g., GCS/S3) or generated on-demand and cached with expiry.

## Payments
- One-time purchase: "10 stars" package sold via Telegram Payments.
- Default price: $1.99 (configurable) for the 10-stars access package.
- On successful payment, mark user as "unlocked" and credit the account (or simply grant course access).
- Admin panel/commands to manually grant access or refund (owner responsibility).

## Non-goals
- No live human tutoring or scheduling of real tutors.
- Not a full LMS with certificates or complex grammar courses in v1.
- No multi-currency pricing logic beyond simple Telegram Payments configuration in v1.

## Assumptions & defaults
- Payment provider: Telegram Payments (default) — simplest in-chat purchase flow and built-in invoice handling.
- Price: 10 stars = $1.99 one-time — a sensible low-price default that owner can change in config.
- Initial deck size: 20 words, delivered as micro-lessons — small enough for quick engagement on first purchase.
- Reminder default: once per day at 09:00 in user's local time — common habit-forming schedule if user does not choose.
- TTS provider: Google Cloud TTS with gTTS fallback — produces clear audio and can be swapped later.
- Persistence: PostgreSQL + Redis — durable storage + job queue/caching for reminders and background tasks.
- Admin chat id: TELEGRAM_ADMIN_CHAT_ID must be provided during deployment — used to send purchase/error notifications.
- Language/UI: bot messages in English by default; translation/localization is an enhancement for later.
- Access model: purchase unlocks access (no per-lesson micro-payments) — simpler UX for v1.


If you want any of these defaults changed (price, deck size, reminder frequency, payment method), tell me which single setting to change next and I will update the brief.