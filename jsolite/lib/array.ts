import { Database } from "bun:sqlite";

export class JsoliteArray<T> {
  private db: Database;
  private name: string;
  private queries!: ReturnType<typeof this.prepareQueries>;

  constructor(db: Database, name: string) {
    this.db = db;
    this.name = name;
    this.createArrayTable();
    this.prepareQueries();
  }

  get tableName(): string {
    return `array-${this.name}`;
  }

  private createArrayTable() {
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS "${this.tableName}" (id INTEGER PRIMARY KEY, value TEXT)`
    );
  }

  private prepareQueries() {
    const queries = {
      insert: this.db.query<void, any>(
        `INSERT INTO "${this.tableName}" (value) VALUES (?)`
      ),
      insertAt: this.db.query<void, [number, string]>(
        `INSERT INTO "${this.tableName}" (id, value) VALUES (?, ?)`
      ),
      length: this.db.query<{ length: number }, any>(
        `SELECT id as length FROM "${this.tableName}" ORDER BY id DESC LIMIT 1`
      ),
      at: this.db.query<{ value: string }, [number]>(
        `SELECT value FROM "${this.tableName}" WHERE id = ?`
      ),
      pop: this.db.query<{ value: string }, any>(
        `DELETE FROM "${this.tableName}" WHERE id = (SELECT id FROM "${this.tableName}" ORDER BY id DESC LIMIT 1) RETURNING value`
      ),
      firstEntry: this.db.query<{ id: number; value: string }, any>(
        `SELECT id, value FROM "${this.tableName}" ORDER BY id ASC LIMIT 1`
      ),
      deleteAt: this.db.query<void, [number]>(
        `DELETE FROM "${this.tableName}" WHERE id = ?`
      ),
      shiftIndices: this.db.query<void, [number]>(
        `UPDATE "${this.tableName}" SET id = id + ?`
      ),
      shiftIndicesGte: this.db.query<void, [number, number]>(
        `UPDATE "${this.tableName}" SET id = id + ? WHERE id >= ?`
      ),
      updateAt: this.db.query<{ value: string }, [string, number]>(
        `UPDATE "${this.tableName}" SET value = ? WHERE id = ? RETURNING value`
      ),
      deleteRange: this.db.query<void, [number, number]>(
        `DELETE FROM "${this.tableName}" WHERE id >= ? AND id < ?`
      ),
      deleteGte: this.db.query<void, [number]>(
        `DELETE FROM "${this.tableName}" WHERE id >= ?`
      ),
      selectAll: this.db.query<{ id: number; value: string }, any>(
        `SELECT id, value FROM "${this.tableName}"`
      ),
    };
    this.queries = queries;
    return queries;
  }

  push(...items: T[]): number {
    for (const item of items) {
      this.queries.insert.run(JSON.stringify(item));
    }
    return this.length - 1;
  }

  get length(): number {
    const result = this.queries.length.get();
    return result ? result.length : 0;
  }

  at(index: number): T | undefined {
    const result =
      index < 0
        ? this.queries.at.get(this.length + index + 1)
        : this.queries.at.get(index + 1);
    return result?.value ? JSON.parse(result.value) : undefined;
  }

  pop(): T | undefined {
    const result = this.queries.pop.get();
    return result?.value ? JSON.parse(result.value) : undefined;
  }

  shift(): T | undefined {
    return this.db.transaction(() => {
      const firstEntry = this.queries.firstEntry.get();
      if (firstEntry) {
        this.queries.deleteAt.run(firstEntry.id);
        this.queries.shiftIndices.run(-1);
        return firstEntry.value ? JSON.parse(firstEntry.value) : undefined;
      }
      return undefined;
    })();
  }

  unshift(...items: T[]): number {
    return this.db.transaction(() => {
      const offset = this.length;
      this.queries.shiftIndices.run(offset + items.length);
      for (let i = 0; i < items.length; i++) {
        this.queries.insertAt.run(i + 1, JSON.stringify(items[i]));
      }
      this.queries.shiftIndicesGte.run(-offset, items.length + 1);
      return this.length;
    })();
  }

  set(index: number, value: T): T | undefined {
    const result =
      index < 0
        ? this.queries.updateAt.get(
            JSON.stringify(value),
            this.length + index + 1
          )
        : this.queries.updateAt.get(JSON.stringify(value), index + 1);
    return result?.value ? JSON.parse(result.value) : undefined;
  }

  slice(start?: number, end?: number) {
    return this.db.transaction(() => {
      const sliceName = `__unnamed-${this.name}-${crypto.randomUUID()}`;
      const sliceArray = new JsoliteArray<T>(this.db, sliceName);
      const len = this.length;

      const normalizedStart =
        start !== undefined
          ? start < 0
            ? Math.max(len + start, 0)
            : Math.min(start, len)
          : 0;
      const normalizedEnd =
        end !== undefined
          ? end < 0
            ? Math.max(len + end, 0)
            : Math.min(end, len)
          : len;

      const startId = normalizedStart + 1;
      const endId = normalizedEnd + 1;
      const offset = startId - 1;

      this.db.run<[number, number, number]>(
        `INSERT INTO "${sliceArray.tableName}" SELECT (id - ?) as id, value FROM "${this.tableName}" WHERE id >= ? AND id < ?`,
        [offset, startId, endId]
      );

      return sliceArray;
    })();
  }

  splice(start: number, deleteCount?: number, ...items: T[]): JsoliteArray<T> {
    return this.db.transaction(() => {
      if (typeof deleteCount !== "number" && items && items.length > 0) {
        throw new Error("deleteCount is required if items are provided");
      }
      if (typeof deleteCount === "number" && deleteCount < 0) {
        throw new Error("deleteCount cannot be negative");
      }
      const removed = this.slice(
        start,
        typeof deleteCount === "number" ? start + deleteCount : undefined
      );

      if (typeof deleteCount === "number" && deleteCount > 0) {
        this.queries.deleteRange.run(start + 1, start + deleteCount + 1);
      } else if (typeof deleteCount !== "number") {
        this.queries.deleteGte.run(start + 1);
      }

      let shiftOffset = items.length - (deleteCount ?? 0);

      if (shiftOffset < 0) {
        this.queries.shiftIndicesGte.run(shiftOffset, start + 1);
      } else if (shiftOffset > 0) {
        const len = this.length;
        shiftOffset = shiftOffset + len - start - 1;
        this.queries.shiftIndicesGte.run(shiftOffset, start + 1);
        shiftOffset = len - start - 1;
      }
      for (let i = 0; i < items.length; i++) {
        this.queries.insertAt.run(start + i + 1, JSON.stringify(items[i]));
      }

      if (shiftOffset > 0) {
        this.queries.shiftIndicesGte.run(
          -shiftOffset,
          start + items.length + 1
        );
      }

      return removed;
    })();
  }

  rename(newName: string): void {
    const oldTableName = this.tableName;
    this.name = newName;
    this.db.exec(`ALTER TABLE "${oldTableName}" RENAME TO "${this.tableName}"`);
    this.prepareQueries();
  }

  drop(): void {
    this.db.exec(`DROP TABLE "${this.tableName}"`);
    Object.values(this.queries).forEach((query) => {
      query.finalize();
    });
  }

  empty(): void {
    this.db.exec(`DELETE FROM "${this.tableName}"`);
  }

  filter(predicate: (item: T) => boolean) {
    return this.db.transaction(() => {
      const filteredName = `__unnamed-${this.name}-${crypto.randomUUID()}`;
      const filteredArray = new JsoliteArray<T>(this.db, filteredName);
      const n = this.length;
      for (let i = 0; i < n; i++) {
        const item = this.at(i);
        if (item !== undefined && predicate(item)) {
          filteredArray.push(item);
        }
      }
      return filteredArray;
    })();
  }

  sort(compare: (a: T, b: T) => number): this {
    this.db.transaction(() => {
      let moved = false;
      const n = this.length;

      do {
        moved = false;
        for (let i = 0; i < n - 1; i++) {
          const a = this.at(i);
          const b = this.at(i + 1);
          if (a !== undefined && b !== undefined) {
            const cmp = compare(a, b);
            if (cmp > 0) {
              this.set(i + 1, a);
              this.set(i, b);
              moved = true;
            }
          }
        }
      } while (moved);
    })();

    return this;
  }

  some(predicate: (item: T) => boolean): boolean {
    const n = this.length;

    for (let i = 0; i < n; i++) {
      const item = this.at(i);
      if (item !== undefined && predicate(item)) {
        return true;
      } else if (item === undefined) {
        break;
      }
    }

    return false;
  }

  every(predicate: (item: T) => boolean): boolean {
    return !this.some((item) => !predicate(item));
  }

  map<R>(callback: (item: T) => R): JsoliteArray<R> {
    return this.db.transaction(() => {
      const mappedTableName = `unnamed-array-${
        this.name
      }-${crypto.randomUUID()}`;
      const mappedArray = new JsoliteArray<R>(this.db, mappedTableName);
      const n = this.length;
      for (let i = 0; i < n; i++) {
        const item = this.at(i);
        mappedArray.push(callback(item!));
      }
      return mappedArray;
    })();
  }

  reduce<R>(
    callback: (accumulator: R, item: T, index: number) => R,
    initial: R
  ): R {
    const n = this.length;
    let acc = initial;

    for (let i = 0; i < n; i++) {
      const item = this.at(i);
      if (item !== undefined) {
        acc = callback(acc, item, i);
      } else {
        break;
      }
    }

    return acc;
  }

  reduceRight<R>(
    callback: (accumulator: R, item: T, index: number) => R,
    initial: R
  ): R {
    const n = this.length;
    let acc = initial;

    for (let i = n - 1; i >= 0; i--) {
      const item = this.at(i);
      if (item !== undefined) {
        acc = callback(acc, item, i);
      } else {
        break;
      }
    }

    return acc;
  }

  find(predicate: (item: T) => boolean): T | undefined {
    const n = this.length;

    for (let i = 0; i < n; i++) {
      const item = this.at(i);
      if (item !== undefined && predicate(item)) {
        return item;
      } else if (item === undefined) {
        break;
      }
    }

    return undefined;
  }

  reverse(): this {
    this.db.transaction(() => {
      const n = this.length;
      for (let i = 0; i <= Math.floor(n / 2); i++) {
        const a = this.at(i);
        const b = this.at(n - i - 1);
        if (a !== undefined && b !== undefined) {
          this.set(i, b);
          this.set(n - i - 1, a);
        }
      }
    })();
    return this;
  }

  forEach(callback: (item: T, index: number) => void): void {
    const n = this.length;

    for (let i = 0; i < n; i++) {
      const item = this.at(i);
      if (item !== undefined) {
        callback(item, i);
      } else {
        break;
      }
    }
  }

  findIndex(predicate: (item: T) => boolean): number | undefined {
    const n = this.length;

    for (let i = 0; i < n; i++) {
      const item = this.at(i);
      if (item !== undefined && predicate(item)) {
        return i;
      } else if (item === undefined) {
        break;
      }
    }

    return undefined;
  }

  debug(): void {
    console.log(this.queries.selectAll.all());
  }

  toJsArray(): T[] {
    return this.queries.selectAll
      .all()
      .map((row: { value: string }) => JSON.parse(row.value));
  }
}
