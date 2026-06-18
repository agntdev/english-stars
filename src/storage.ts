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

export type ReminderCadence = "daily" | "every-other-day" | "off";

export interface ReminderData {
  time: string;
  cadence?: ReminderCadence;
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