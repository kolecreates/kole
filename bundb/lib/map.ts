import { Database } from "bun:sqlite";

export interface BunDBMap<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  has(key: K): boolean;
  delete(key: K): void;
  $on(event: string, callback: (data: any) => void): () => void;
  $intercept(event: string, interceptor: (data: any) => any): void;
}

export class BunDBMapImpl<K, V> implements BunDBMap<K, V> {
  private db: Database;
  private tableName: string;
  private hooks: Map<string, Set<(data: any) => void>>;
  private intercepts: Map<string, ((data: any) => any)[]>;
  private globalHooks: Map<string, Set<(data: any) => void>>;
  private globalIntercepts: Map<string, ((data: any) => any)[]>;

  constructor(
    db: Database,
    tableName: string,
    globalHooks: Map<string, Set<(data: any) => void>>,
    globalIntercepts: Map<string, ((data: any) => any)[]>
  ) {
    this.db = db;
    this.tableName = tableName;
    this.hooks = new Map();
    this.intercepts = new Map();
    this.globalHooks = globalHooks;
    this.globalIntercepts = globalIntercepts;
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS "${this.tableName}" (key PRIMARY KEY, value)`
    );
  }

  get(key: K): V | undefined {
    const eventData = { map: this, key };
    const interceptResult = this.runIntercepts("map.get", eventData);
    if (interceptResult !== undefined) {
      return interceptResult;
    }
    const result = this.db
      .query<{ value: string }, { $key: string }>(
        `SELECT value FROM "${this.tableName}" WHERE key = $key`
      )
      .get({ $key: JSON.stringify(key) });
    return result ? JSON.parse(result.value) : undefined;
  }

  set(key: K, value: V): void {
    const eventData = { map: this, key, value };
    const interceptResult = this.runIntercepts("map.set", eventData);
    if (interceptResult !== undefined) {
      value = interceptResult;
    }
    this.db
      .query(
        `INSERT OR REPLACE INTO "${this.tableName}" (key, value) VALUES (?, ?)`
      )
      .run(JSON.stringify(key), JSON.stringify(value));
    this.triggerHooks("map.set", eventData);
  }

  has(key: K): boolean {
    const result = this.db
      .query(`SELECT 1 FROM "${this.tableName}" WHERE key = ?`)
      .get(JSON.stringify(key));
    return !!result;
  }

  delete(key: K): void {
    const eventData = { map: this, key };
    const interceptResult = this.runIntercepts("map.delete", eventData);
    if (interceptResult === false) {
      return;
    }
    this.db
      .query(`DELETE FROM "${this.tableName}" WHERE key = ?`)
      .run(JSON.stringify(key));
    this.triggerHooks("map.delete", eventData);
  }

  $on(event: string, callback: (data: any) => void): () => void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, new Set());
    }
    this.hooks.get(event)!.add(callback);
    return () => {
      this.hooks.get(event)!.delete(callback);
    };
  }

  $intercept(event: string, interceptor: (data: any) => any): void {
    if (!this.intercepts.has(event)) {
      this.intercepts.set(event, []);
    }
    this.intercepts.get(event)!.push(interceptor);
  }

  private triggerHooks(event: string, data: any): void {
    const globalCallbacks = this.globalHooks.get(event);
    if (globalCallbacks) {
      for (const callback of globalCallbacks) {
        callback(data);
      }
    }

    const callbacks = this.hooks.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(data);
      }
    }
  }

  private runIntercepts(event: string, data: any): any {
    const globalInterceptors = this.globalIntercepts.get(event);
    if (globalInterceptors) {
      for (const interceptor of globalInterceptors) {
        const result = interceptor(data);
        if (result !== undefined) {
          return result;
        }
      }
    }
    const interceptors = this.intercepts.get(event);
    if (interceptors) {
      for (const interceptor of interceptors) {
        const result = interceptor(data);
        if (result !== undefined) {
          return result;
        }
      }
    }
    return undefined;
  }
}