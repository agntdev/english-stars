import { Queue, Worker } from "bullmq";
import type { Api, RawApi } from "grammy";
import { getReminderStorage } from "./storage.js";

const REMINDER_QUEUE = "reminders";
const REMINDER_PREFIX = "reminder";

export interface ReminderJobData {
  userId: string;
  time: string;
  cadence: string;
}

function buildCron(time: string, _cadence?: string): string {
  const [hours, minutes] = time.split(":");
  return `${minutes} ${hours} * * *`;
}

let _queue: Queue<ReminderJobData> | undefined;

function getQueue(): Queue<ReminderJobData> | undefined {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return undefined;
  if (!_queue) {
    _queue = new Queue<ReminderJobData>(REMINDER_QUEUE, {
      connection: { url: redisUrl },
      prefix: REMINDER_PREFIX,
    });
  }
  return _queue;
}

export async function scheduleReminder(userId: string, time: string, cadence?: string): Promise<void> {
  const queue = getQueue();
  if (!queue) return;
  const schedulerId = `reminder:${userId}`;
  const cron = buildCron(time, cadence);
  try {
    await queue.removeJobScheduler(schedulerId);
  } catch {
    // No existing scheduler is fine
  }
  await queue.upsertJobScheduler(
    schedulerId,
    { pattern: cron },
    {
      name: "send-reminder",
      data: { userId, time, cadence: cadence ?? "daily" },
    },
  );
}

export async function cancelReminder(userId: string): Promise<void> {
  const queue = getQueue();
  if (!queue) return;
  const schedulerId = `reminder:${userId}`;
  try {
    await queue.removeJobScheduler(schedulerId);
  } catch {
    // Scheduler may not exist
  }
}

const FORTY_SEVEN_HOURS_MS = 47 * 60 * 60 * 1000;

export function startReminderWorker(botApi: Api<RawApi>): void {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return;
  new Worker<ReminderJobData>(
    REMINDER_QUEUE,
    async (job) => {
      const { userId, time, cadence } = job.data;
      try {
        if (cadence === "every_other_day") {
          const reminderStorage = getReminderStorage();
          const reminder = await reminderStorage.read(userId);
          const lastRemindedAt = reminder?.lastRemindedAt;
          const now = Date.now();
          if (lastRemindedAt && now - lastRemindedAt < FORTY_SEVEN_HOURS_MS) {
            return;
          }
          await reminderStorage.write(userId, {
            time,
            cadence,
            lastRemindedAt: now,
          });
          await botApi.sendMessage(
            Number(userId),
            `⏰ Reminder! Time for your practice session.`,
          );
        } else {
          await botApi.sendMessage(
            Number(userId),
            `⏰ Reminder! Time for your daily practice session.`,
          );
        }
      } catch (err) {
        console.error(`Failed to send reminder to ${userId}:`, err);
      }
    },
    {
      connection: { url: redisUrl },
      prefix: REMINDER_PREFIX,
    },
  );
}
