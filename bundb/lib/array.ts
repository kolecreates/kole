import { Database } from "bun:sqlite";

export interface BunDBArray<T> {
  push(...items: T[]): number;
  pop(): T | undefined;
  shift(): T | undefined;
  unshift(...items: T[]): number;
  length: number;
  [index: number]: T;
  $on(event: string, callback: (data: any) => void): () => void;
  $intercept(event: string, interceptor: (data: any) => any): void;
}

const indexAccessHandler = {
  get(target: BunDBArrayImpl<any>, prop: string | symbol) {
    const index = parseInt(prop as string, 10);
    if (!isNaN(index)) {
      return target.get(index);
    }
    return target[prop as keyof typeof target];
  },
  set(target: BunDBArrayImpl<any>, prop: string | symbol, value: any) {
    const index = parseInt(prop as string, 10);
    if (!isNaN(index)) {
      target.set(index, value);
      return true;
    }

    return false;
  },
};

export class BunDBArrayImpl<T> implements BunDBArray<T> {
  static withIndexAccessSupport<T>(
    db: Database,
    tableName: string,
    globalHooks: Map<string, Set<(data: any) => void>>,
    globalIntercepts: Map<string, ((data: any) => any)[]>
  ): BunDBArray<T> {
    const arrayImpl = new BunDBArrayImpl<T>(
      db,
      tableName,
      globalHooks,
      globalIntercepts
    );
    return new Proxy(arrayImpl, indexAccessHandler) as BunDBArray<T>;
  }

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
      `CREATE TABLE IF NOT EXISTS "${this.tableName}" (id INTEGER PRIMARY KEY, value) WITHOUT ROWID`
    );
  }

  push(...items: T[]): number {
    const eventData = { array: this, items };
    const interceptResult = this.runIntercepts("array.push", eventData);
    if (interceptResult !== undefined) {
      items = interceptResult;
    }

    const stmt = this.db.prepare<{ id: number }, any>(
      `INSERT INTO "${this.tableName}" (id, value) VALUES (?, ?)`
    );

    let lastId = 0;

    this.db.transaction(() => {
      const currentLastId = this.length;
      for (let i = 0; i < items.length; i++) {
        lastId = currentLastId + i;
        stmt.run(lastId, JSON.stringify(items[i]));
      }
    })();

    const newLength = lastId;
    this.triggerHooks("array.push", { array: this, items });
    return newLength;
  }

  pop(): T | undefined {
    const lastItem = this.db
      .prepare<{ id: number; value: string }, any>(
        `SELECT id, value FROM "${this.tableName}" ORDER BY id DESC LIMIT 1`
      )
      .get();

    if (lastItem) {
      this.db.run(`DELETE FROM "${this.tableName}" WHERE id = ?`, [
        lastItem.id,
      ]);
      const value = JSON.parse(lastItem.value);
      this.triggerHooks("array.pop", { array: this, value });
      return value;
    }

    return undefined;
  }

  shift(): T | undefined {
    const value = this.db.transaction(() => {
      const firstItem = this.db
        .query<{ id: number; value: string }, any>(
          `SELECT id, value FROM "${this.tableName}" ORDER BY id ASC LIMIT 1`
        )
        .get();

      if (firstItem) {
        this.db.run(`DELETE FROM "${this.tableName}" WHERE id = ?`, [
          firstItem.id,
        ]);
        this.db.run(`UPDATE "${this.tableName}" SET id = id - 1`);
        const value = JSON.parse(firstItem.value);
        return value;
      }

      return undefined;
    })();

    this.triggerHooks("array.shift", { array: this, value });
    return value;
  }

  unshift(...items: T[]): number {
    const eventData = { array: this, items };
    const interceptResult = this.runIntercepts("array.unshift", eventData);
    if (interceptResult !== undefined) {
      items = interceptResult;
    }

    this.db.transaction(() => {
      const offset = this.length;

      this.db.run(`UPDATE "${this.tableName}" SET id = id + ?`, [
        offset + items.length,
      ]);

      const stmt = this.db.prepare(
        `INSERT INTO "${this.tableName}" (id, value) VALUES (?, ?)`
      );
      items.forEach((item, index) => {
        stmt.run(index, JSON.stringify(item));
      });
      this.db.run(`UPDATE "${this.tableName}" SET id = id - ? WHERE id >= ?`, [
        offset,
        items.length,
      ]);
    })();

    const newLength = this.length;
    this.triggerHooks("array.unshift", { array: this, items });
    return newLength;
  }

  get length(): number {
    return (
      this.db
        .query<{ length: number }, any>(
          `SELECT (id + 1) AS length FROM "${this.tableName}" ORDER BY id DESC LIMIT 1`
        )
        .get()?.length ?? 0
    );
  }

  get(index: number): T | undefined {
    const item = this.db
      .query<{ value: string }, any>(
        `SELECT value FROM "${this.tableName}" WHERE id = ?`
      )
      .get(index);
    return item ? JSON.parse(item.value) : undefined;
  }

  set(index: number, value: T): void {
    const eventData = { array: this, index, value };
    const interceptResult = this.runIntercepts("array.set", eventData);
    if (interceptResult !== undefined) {
      value = interceptResult;
    }

    this.db.run(`UPDATE "${this.tableName}" SET value = ? WHERE id = ?`, [
      JSON.stringify(value),
      index,
    ]);

    this.triggerHooks("array.set", eventData);
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

  [index: number]: T;
}

Object.defineProperty(BunDBArrayImpl.prototype, Symbol.iterator, {
  enumerable: false,
  writable: true,
  configurable: true,
  value: function* () {
    let index = 0;
    while (true) {
      const item = this.get(index);
      if (item === undefined) break;
      yield item;
      index++;
    }
  },
});
