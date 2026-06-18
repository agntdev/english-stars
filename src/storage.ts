import type { StorageAdapter } from "grammy";
import { MemorySessionStorage, defaultRedisStorage, defaultPostgresStorage } from "./toolkit/index.js";

export interface UserData {
  stars: number;
  unlocked: boolean;
}

let _starsStorage: StorageAdapter<number> | undefined;

export function getStarsStorage(): StorageAdapter<number> {
  if (!_starsStorage) {
    if (process.env.DATABASE_URL) {
      _starsStorage = defaultPostgresStorage<number>(process.env.DATABASE_URL, "stars:");
    } else if (process.env.REDIS_URL) {
      _starsStorage = defaultRedisStorage<number>(process.env.REDIS_URL);
    } else {
      _starsStorage = new MemorySessionStorage<number>();
    }
  }
  return _starsStorage;
}

let _userDataStorage: StorageAdapter<UserData> | undefined;

export function getUserDataStorage(): StorageAdapter<UserData> {
  if (!_userDataStorage) {
    if (process.env.DATABASE_URL) {
      _userDataStorage = defaultPostgresStorage<UserData>(process.env.DATABASE_URL, "user:");
    } else if (process.env.REDIS_URL) {
      _userDataStorage = defaultRedisStorage<UserData>(process.env.REDIS_URL);
    } else {
      _userDataStorage = new MemorySessionStorage<UserData>();
    }
  }
  return _userDataStorage;
}

export interface LocaleData {
  locale: string;
}

let _localeStorage: StorageAdapter<LocaleData> | undefined;

export function getLocaleStorage(): StorageAdapter<LocaleData> {
  if (!_localeStorage) {
    if (process.env.DATABASE_URL) {
      _localeStorage = defaultPostgresStorage<LocaleData>(process.env.DATABASE_URL, "locale:");
    } else if (process.env.REDIS_URL) {
      _localeStorage = defaultRedisStorage<LocaleData>(process.env.REDIS_URL);
    } else {
      _localeStorage = new MemorySessionStorage<LocaleData>();
    }
  }
  return _localeStorage;
}

export interface ReminderData {
  time: string;
}

let _reminderStorage: StorageAdapter<ReminderData> | undefined;

export function getReminderStorage(): StorageAdapter<ReminderData> {
  if (!_reminderStorage) {
    if (process.env.DATABASE_URL) {
      _reminderStorage = defaultPostgresStorage<ReminderData>(process.env.DATABASE_URL, "reminder:");
    } else if (process.env.REDIS_URL) {
      _reminderStorage = defaultRedisStorage<ReminderData>(process.env.REDIS_URL);
    } else {
      _reminderStorage = new MemorySessionStorage<ReminderData>();
    }
  }
  return _reminderStorage;
}

export interface StatsData {
  totalStarts: number;
  totalSales: number;
}

let _statsStorage: StorageAdapter<StatsData> | undefined;

export function getStatsStorage(): StorageAdapter<StatsData> {
  if (!_statsStorage) {
    if (process.env.DATABASE_URL) {
      _statsStorage = defaultPostgresStorage<StatsData>(process.env.DATABASE_URL, "s:");
    } else if (process.env.REDIS_URL) {
      _statsStorage = defaultRedisStorage<StatsData>(process.env.REDIS_URL);
    } else {
      _statsStorage = new MemorySessionStorage<StatsData>();
    }
  }
  return _statsStorage;
}

export async function incrementStat(key: string, field: keyof StatsData): Promise<void> {
  const storage = getStatsStorage();
  const current = (await storage.read(key)) ?? { totalStarts: 0, totalSales: 0 };
  current[field]++;
  await storage.write(key, current);
}

export interface QuizScoreEntry {
  quizType: "practice" | "typeword";
  score: number;
  total: number;
  at: string;
}

export interface AppendableStorage {
  append(key: string, value: string): Promise<void>;
  readAppendLog(key: string): Promise<string[]>;
}

let _quizScoreStorage: AppendableStorage | undefined;

export function getQuizScoreStorage(): AppendableStorage {
  if (!_quizScoreStorage) {
    if (process.env.DATABASE_URL) {
      _quizScoreStorage = defaultPostgresStorage<unknown>(process.env.DATABASE_URL, "quiz:") as unknown as AppendableStorage;
    } else if (process.env.REDIS_URL) {
      _quizScoreStorage = defaultRedisStorage<unknown>(process.env.REDIS_URL) as unknown as AppendableStorage;
    } else {
      _quizScoreStorage = new MemorySessionStorage<unknown>() as unknown as AppendableStorage;
    }
  }
  return _quizScoreStorage;
}

export async function saveQuizScore(
  userId: string,
  quizType: "practice" | "typeword",
  score: number,
  total: number,
): Promise<void> {
  const storage = getQuizScoreStorage();
  await storage.append(userId, JSON.stringify({
    quizType,
    score,
    total,
    at: new Date().toISOString(),
  }));
}

export async function getQuizScores(userId: string): Promise<QuizScoreEntry[]> {
  const storage = getQuizScoreStorage();
  const raw = await storage.readAppendLog(userId);
  return raw.map((r) => JSON.parse(r) as QuizScoreEntry);
}