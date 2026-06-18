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

export interface ActiveUserData {
  ts: number;
}

export interface StatsData {
  totalSales: number;
  totalRevenue: number;
}

// Extended storage adapter that also exposes readAllKeys (available on all
// three toolkit implementations: Memory, Redis, Postgres).
export interface ExtendedStorageAdapter<T> extends StorageAdapter<T> {
  readAllKeys(): IterableIterator<string> | AsyncIterableIterator<string> | string[];
}

let _activeUserStorage: StorageAdapter<ActiveUserData> | undefined;

export function getActiveUserStorage(): StorageAdapter<ActiveUserData> {
  if (!_activeUserStorage) {
    if (process.env.DATABASE_URL) {
      _activeUserStorage = defaultPostgresStorage<ActiveUserData>(process.env.DATABASE_URL, "active:");
    } else if (process.env.REDIS_URL) {
      _activeUserStorage = defaultRedisStorage<ActiveUserData>(process.env.REDIS_URL);
    } else {
      _activeUserStorage = new MemorySessionStorage<ActiveUserData>();
    }
  }
  return _activeUserStorage;
}

let _statsStorage: StorageAdapter<StatsData> | undefined;

export function getStatsStorage(): StorageAdapter<StatsData> {
  if (!_statsStorage) {
    if (process.env.DATABASE_URL) {
      _statsStorage = defaultPostgresStorage<StatsData>(process.env.DATABASE_URL, "stats:");
    } else if (process.env.REDIS_URL) {
      _statsStorage = defaultRedisStorage<StatsData>(process.env.REDIS_URL);
    } else {
      _statsStorage = new MemorySessionStorage<StatsData>();
    }
  }
  return _statsStorage;
}

const STATS_KEY = "global";

export async function getStats(): Promise<StatsData> {
  const storage = getStatsStorage();
  const data = await storage.read(STATS_KEY);
  return data ?? { totalSales: 0, totalRevenue: 0 };
}

export async function recordSale(revenue: number): Promise<void> {
  const storage = getStatsStorage();
  const current = await getStats();
  current.totalSales += 1;
  current.totalRevenue += revenue;
  await storage.write(STATS_KEY, current);
}

export async function countActiveUsers(): Promise<number> {
  const storage = getActiveUserStorage() as ExtendedStorageAdapter<ActiveUserData>;
  const keys = storage.readAllKeys();
  if (Symbol.asyncIterator in (keys as object)) {
    let count = 0;
    for await (const _ of keys as AsyncIterableIterator<string>) count++;
    return count;
  }
  if (Array.isArray(keys)) return keys.length;
  let count = 0;
  for (const _ of keys as IterableIterator<string>) count++;
  return count;
}

export async function recordActiveUser(userId: string): Promise<void> {
  const storage = getActiveUserStorage();
  await storage.write(userId, { ts: Date.now() });
}