import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Redis } from "@upstash/redis";

export interface Kv {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  update<T>(key: string, fn: (current: T | null) => T | null): Promise<T | null>;
}

const PREFIX = "josias:";

type StoreOptions = {
  nodeEnv?: string;
  url?: string;
  token?: string;
  dataDir?: string;
};

let cached: Kv | null = null;
let cachedKey = "";

export function resetKvForTests(): void {
  cached = null;
  cachedKey = "";
}

export function createKv(options: StoreOptions = {}): Kv {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const url = options.url ?? process.env.KV_REST_API_URL;
  const token = options.token ?? process.env.KV_REST_API_TOKEN;
  if (url && token) {
    return new RedisKv(url, token);
  }
  if (nodeEnv === "production") {
    throw new Error(
      "KV_REST_API_URL and KV_REST_API_TOKEN are required in production. The file store is for local development only.",
    );
  }
  const dir = options.dataDir ?? process.env.DASHBOARD_DATA_DIR ?? path.join(process.cwd(), ".data");
  return new FileKv(path.join(dir, "store.json"));
}

export function getKv(): Kv {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const dir = process.env.DASHBOARD_DATA_DIR ?? path.join(process.cwd(), ".data");
  const key = url && token ? `redis:${url}` : `file:${nodeEnv}:${dir}`;
  if (!cached || cachedKey !== key) {
    cached = createKv({ nodeEnv, url, token, dataDir: dir });
    cachedKey = key;
  }
  return cached;
}

class FileKv implements Kv {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async read(): Promise<Record<string, unknown>> {
    try {
      const text = await readFile(this.file, "utf8");
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {};
      }
      throw error;
    }
  }

  private async write(data: Record<string, unknown>): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2));
    await rename(tmp, this.file);
  }

  async get<T>(key: string): Promise<T | null> {
    const stored = `${PREFIX}${key}`;
    return this.enqueue(async () => {
      const data = await this.read();
      return stored in data ? (data[stored] as T) : null;
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    const stored = `${PREFIX}${key}`;
    await this.enqueue(async () => {
      const data = await this.read();
      data[stored] = value;
      await this.write(data);
    });
  }

  async del(key: string): Promise<void> {
    const stored = `${PREFIX}${key}`;
    await this.enqueue(async () => {
      const data = await this.read();
      delete data[stored];
      await this.write(data);
    });
  }

  async update<T>(key: string, fn: (current: T | null) => T | null): Promise<T | null> {
    const stored = `${PREFIX}${key}`;
    return this.enqueue(async () => {
      const data = await this.read();
      const current = stored in data ? (data[stored] as T) : null;
      const next = fn(current);
      if (next === null) {
        delete data[stored];
      } else {
        data[stored] = next;
      }
      await this.write(data);
      return next;
    });
  }
}

class RedisKv implements Kv {
  private readonly redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  private stored(key: string): string {
    return `${PREFIX}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get<T>(this.stored(key));
    return value ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.redis.set(this.stored(key), value);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(this.stored(key));
  }

  async update<T>(key: string, fn: (current: T | null) => T | null): Promise<T | null> {
    const lockKey = this.stored(`${key}:lock`);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const acquired = await this.redis.set(lockKey, "1", { nx: true, px: 5000 });
      if (acquired === "OK") {
        try {
          const current = await this.get<T>(key);
          const next = fn(current);
          if (next === null) {
            await this.del(key);
          } else {
            await this.set(key, next);
          }
          return next;
        } finally {
          await this.redis.del(lockKey);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Could not lock dashboard storage");
  }
}
