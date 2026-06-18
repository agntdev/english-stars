import type { StorageAdapter } from "grammy";
import { MemorySessionStorage, defaultRedisStorage } from "./toolkit/index.js";

export interface UserData {
  stars: number;
  unlocked: boolean;
}

export interface QuizResult {
  quizId: string;
  score: number;
  total: number;
  completedAt: number;
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

let _quizResultsStorage: StorageAdapter<QuizResult[]> | undefined;

export function getQuizResultsStorage(): StorageAdapter<QuizResult[]> {
  if (!_quizResultsStorage) {
    if (process.env.REDIS_URL) {
      _quizResultsStorage = defaultRedisStorage<QuizResult[]>(process.env.REDIS_URL);
    } else {
      _quizResultsStorage = new MemorySessionStorage<QuizResult[]>();
    }
  }
  return _quizResultsStorage;
}