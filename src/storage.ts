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

export interface VocabWord {
  word: string;
  partOfSpeech: string;
  definition: string;
  example: string;
}

const SEED_VOCABULARY: VocabWord[] = [
  { word: "Ephemeral", partOfSpeech: "adjective", definition: "Lasting for a very short time.", example: "The beauty of cherry blossoms is ephemeral, lasting only a few days." },
  { word: "Ubiquitous", partOfSpeech: "adjective", definition: "Present, appearing, or found everywhere.", example: "Smartphones have become ubiquitous in modern society." },
  { word: "Pragmatic", partOfSpeech: "adjective", definition: "Dealing with things sensibly and realistically.", example: "She took a pragmatic approach to solving the budget crisis." },
  { word: "Eloquent", partOfSpeech: "adjective", definition: "Fluent or persuasive in speaking or writing.", example: "The graduation speaker delivered an eloquent address." },
  { word: "Resilient", partOfSpeech: "adjective", definition: "Able to withstand or recover quickly from difficult conditions.", example: "Children are remarkably resilient and adapt to change well." },
];

let _vocabStorage: StorageAdapter<VocabWord[]> | undefined;

export async function getVocabWords(): Promise<VocabWord[]> {
  if (!_vocabStorage) {
    if (process.env.DATABASE_URL) {
      _vocabStorage = defaultPostgresStorage<VocabWord[]>(process.env.DATABASE_URL, "vocab:");
    } else if (process.env.REDIS_URL) {
      _vocabStorage = defaultRedisStorage<VocabWord[]>(process.env.REDIS_URL);
    } else {
      _vocabStorage = new MemorySessionStorage<VocabWord[]>();
    }
  }
  const existing = await _vocabStorage.read("words");
  if (existing && existing.length > 0) return existing;
  await _vocabStorage.write("words", SEED_VOCABULARY);
  return SEED_VOCABULARY;
}