import type { StorageAdapter } from "grammy";
import { MemorySessionStorage, defaultRedisStorage } from "./toolkit/index.js";

export interface UserData {
  stars: number;
  unlocked: boolean;
}

let _starsStorage: StorageAdapter<number> | undefined;

export function getStarsStorage(): StorageAdapter<number> {
  if (!_starsStorage) {
    if (process.env.REDIS_URL) {
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
    if (process.env.REDIS_URL) {
      _userDataStorage = defaultRedisStorage<UserData>(process.env.REDIS_URL);
    } else {
      _userDataStorage = new MemorySessionStorage<UserData>();
    }
  }
  return _userDataStorage;
}

export interface ReminderTime {
  time: string;
}

let _reminderTimeStorage: StorageAdapter<ReminderTime> | undefined;

export function getReminderTimeStorage(): StorageAdapter<ReminderTime> {
  if (!_reminderTimeStorage) {
    if (process.env.REDIS_URL) {
      _reminderTimeStorage = defaultRedisStorage<ReminderTime>(process.env.REDIS_URL);
    } else {
      _reminderTimeStorage = new MemorySessionStorage<ReminderTime>();
    }
  }
  return _reminderTimeStorage;
}