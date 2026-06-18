import { createRequire } from "node:module";

export interface BotStats {
  activeUsers: number;
  salesCount: number;
  totalMessages: number;
}

export interface StatsStore {
  getStats(): Promise<BotStats>;
  recordMessage(userId: number): Promise<void>;
  recordSale(): Promise<void>;
}

const PREFIX = "stats:";

class RedisStatsStore implements StatsStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly redis: any) {}

  private async getNum(key: string): Promise<number> {
    const v: string | null = await this.redis.get(PREFIX + key);
    return v ? parseInt(v, 10) : 0;
  }

  async getStats(): Promise<BotStats> {
    const [activeUsers, salesCount, totalMessages] = await Promise.all([
      this.redis.scard(PREFIX + "users"),
      this.getNum("sales"),
      this.getNum("msgs"),
    ]);
    return { activeUsers, salesCount, totalMessages };
  }

  async recordMessage(userId: number): Promise<void> {
    await Promise.all([
      this.redis.sadd(PREFIX + "users", String(userId)),
      this.redis.incr(PREFIX + "msgs"),
    ]);
  }

  async recordSale(): Promise<void> {
    await this.redis.incr(PREFIX + "sales");
  }
}

class MemoryStatsStore implements StatsStore {
  private users = new Set<string>();
  private messages = 0;
  private sales = 0;

  async getStats(): Promise<BotStats> {
    return {
      activeUsers: this.users.size,
      salesCount: this.sales,
      totalMessages: this.messages,
    };
  }

  async recordMessage(userId: number): Promise<void> {
    this.users.add(String(userId));
    this.messages++;
  }

  async recordSale(): Promise<void> {
    this.sales++;
  }
}

let _store: StatsStore | null = null;

export function getStatsStore(): StatsStore {
  if (!_store) {
    _store = createStatsStore();
  }
  return _store;
}

export function setStatsStore(store: StatsStore): void {
  _store = store;
}

function createStatsStore(): StatsStore {
  const url = process.env.REDIS_URL;
  if (url) {
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ioredis: any = require("ioredis");
    const Redis = ioredis.default ?? ioredis.Redis ?? ioredis;
    return new RedisStatsStore(
      new Redis(url, { maxRetriesPerRequest: null, lazyConnect: false }),
    );
  }
  return new MemoryStatsStore();
}
