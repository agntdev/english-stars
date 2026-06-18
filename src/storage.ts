import type { StorageAdapter } from "grammy";
import { MemorySessionStorage, defaultRedisStorage } from "./toolkit/index.js";

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