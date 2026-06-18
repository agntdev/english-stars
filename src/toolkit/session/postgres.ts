import { createRequire } from "node:module";
import type { StorageAdapter } from "grammy";
import type { Pool as PgPool } from "pg";

export interface PgLike {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const TABLE_NAME = "kv_store";
const LOG_TABLE_NAME = "kv_log";

export class PostgresStorage<T> implements StorageAdapter<T> {
  private tablePromise: Promise<void> | null = null;
  private tableReady = false;

  constructor(
    private readonly pool: PgLike,
    private readonly prefix = "data:",
  ) {}

  private k(key: string): string {
    return this.prefix + key;
  }

  private ensureTable(): Promise<void> {
    if (this.tableReady) return Promise.resolve();
    if (!this.tablePromise) {
      this.tablePromise = this.pool
        .query(
          `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (key TEXT PRIMARY KEY, value JSONB NOT NULL)`,
        )
        .then(() =>
          this.pool.query(
            `CREATE TABLE IF NOT EXISTS ${LOG_TABLE_NAME} (key TEXT NOT NULL, value JSONB NOT NULL, seq BIGSERIAL PRIMARY KEY)`,
          ),
        )
        .then(() => {
          this.tableReady = true;
        });
    }
    return this.tablePromise;
  }

  async read(key: string): Promise<T | undefined> {
    await this.ensureTable();
    const result = await this.pool.query(
      `SELECT value FROM ${TABLE_NAME} WHERE key = $1`,
      [this.k(key)],
    );
    if (result.rows.length === 0) return undefined;
    return result.rows[0].value as T;
  }

  async write(key: string, value: T): Promise<void> {
    await this.ensureTable();
    await this.pool.query(
      `INSERT INTO ${TABLE_NAME} (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`,
      [this.k(key), JSON.stringify(value)],
    );
  }

  async delete(key: string): Promise<void> {
    await this.ensureTable();
    await this.pool.query(`DELETE FROM ${TABLE_NAME} WHERE key = $1`, [
      this.k(key),
    ]);
  }

  async has(key: string): Promise<boolean> {
    await this.ensureTable();
    const result = await this.pool.query(
      `SELECT EXISTS(SELECT 1 FROM ${TABLE_NAME} WHERE key = $1) AS "exists"`,
      [this.k(key)],
    );
    return (result.rows[0].exists as boolean) === true;
  }

  async *readAllKeys(): AsyncIterableIterator<string> {
    await this.ensureTable();
    const result = await this.pool.query(
      `SELECT key FROM ${TABLE_NAME} WHERE key LIKE $1`,
      [this.prefix + "%"],
    );
    for (const row of result.rows) {
      yield (row.key as string).slice(this.prefix.length);
    }
  }

  async append(key: string, value: string): Promise<void> {
    await this.ensureTable();
    await this.pool.query(
      `INSERT INTO ${LOG_TABLE_NAME} (key, value) VALUES ($1, $2)`,
      [this.k(key), value],
    );
  }

  async readAppendLog(key: string): Promise<string[]> {
    await this.ensureTable();
    const result = await this.pool.query(
      `SELECT value FROM ${LOG_TABLE_NAME} WHERE key = $1 ORDER BY seq`,
      [this.k(key)],
    );
    return result.rows.map((r) => r.value as string);
  }
}

export function defaultPostgresStorage<T>(
  url: string,
  prefix = "data:",
): StorageAdapter<T> {
  const require = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pg: any = require("pg");
  const Pool = pg.Pool ?? pg.default?.Pool;
  const pool = new Pool({ connectionString: url, max: 5 }) as PgPool;
  return new PostgresStorage<T>(pool, prefix);
}
