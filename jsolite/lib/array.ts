import { Database } from "bun:sqlite";

export const createArrayTable = (db: Database, name: string) => {
  db.exec(
    `CREATE TABLE IF NOT EXISTS "${name}" (id INTEGER PRIMARY KEY, value TEXT)`
  );
};

export const init = (db: Database, name: string) => {
  createArrayTable(db, name);
  return {
    db,
    name,
    queries: {
      insert: db.query<void, any>(`INSERT INTO "${name}" (value) VALUES (?)`),
      insertAt: db.query<void, [number, string]>(
        `INSERT INTO "${name}" (id, value) VALUES (?, ?)`
      ),
      length: db.query<{ length: number }, any>(
        `SELECT id as length FROM "${name}" ORDER BY id DESC LIMIT 1`
      ),
      at: db.query<{ value: string }, [number]>(
        `SELECT value FROM "${name}" WHERE id = ?`
      ),
      pop: db.query<{ value: string }, any>(
        `DELETE FROM "${name}" WHERE id = (SELECT id FROM "${name}" ORDER BY id DESC LIMIT 1) RETURNING value`
      ),
      firstEntry: db.query<{ id: number; value: string }, any>(
        `SELECT id, value FROM "${name}" ORDER BY id ASC LIMIT 1`
      ),
      deleteAt: db.query<void, [number]>(`DELETE FROM "${name}" WHERE id = ?`),
      shiftIndices: db.query<void, [number]>(
        `UPDATE "${name}" SET id = id + ?`
      ),
      shiftIndicesGte: db.query<void, [number, number]>(
        `UPDATE "${name}" SET id = id + ? WHERE id >= ?`
      ),
      updateAt: db.query<{ value: string }, [string, number]>(
        `UPDATE "${name}" SET value = ? WHERE id = ? RETURNING value`
      ),
      deleteRange: db.query<void, [number, number]>(
        `DELETE FROM "${name}" WHERE id >= ? AND id < ?`
      ),
      deleteGte: db.query<void, [number]>(
        `DELETE FROM "${name}" WHERE id >= ?`
      ),
      selectAll: db.query<{ id: number; value: string }, any>(
        `SELECT id, value FROM "${name}"`
      ),
    },
  };
};

export type JsoliteArrayContext = ReturnType<typeof init>;

export const push = (ctx: JsoliteArrayContext, ...items: any[]) => {
  for (const item of items) {
    ctx.queries.insert.run(JSON.stringify(item));
  }

  return length(ctx) - 1;
};

export const length = (ctx: JsoliteArrayContext) => {
  const result = ctx.queries.length.get();
  if (result) {
    return result.length;
  }
  return 0;
};

export const at = (ctx: JsoliteArrayContext, index: number) => {
  const result =
    index < 0
      ? ctx.queries.at.get(length(ctx) + index + 1)
      : ctx.queries.at.get(index + 1);
  return result?.value ? JSON.parse(result.value) : undefined;
};

export const pop = (ctx: JsoliteArrayContext) => {
  const result = ctx.queries.pop.get();
  return result?.value ? JSON.parse(result.value) : undefined;
};

export const shift = (ctx: JsoliteArrayContext) => {
  const firstEntry = ctx.queries.firstEntry.get();
  if (firstEntry) {
    ctx.queries.deleteAt.run(firstEntry.id);
    ctx.queries.shiftIndices.run(-1);
    return firstEntry.value ? JSON.parse(firstEntry.value) : undefined;
  }
  return undefined;
};

export const unshift = (ctx: JsoliteArrayContext, ...items: any[]) => {
  const offset = length(ctx);
  ctx.queries.shiftIndices.run(offset + items.length);
  for (let i = 0; i < items.length; i++) {
    ctx.queries.insertAt.run(i + 1, JSON.stringify(items[i]));
  }
  ctx.queries.shiftIndicesGte.run(-offset, items.length + 1);

  return length(ctx);
};

export const set = (ctx: JsoliteArrayContext, index: number, value: any) => {
  const result =
    index < 0
      ? ctx.queries.updateAt.get(JSON.stringify(value), length(ctx) + index + 1)
      : ctx.queries.updateAt.get(JSON.stringify(value), index + 1);

  return result?.value ? JSON.parse(result.value) : undefined;
};

export const slice = (
  ctx: JsoliteArrayContext,
  start?: number,
  end?: number
) => {
  const sliceName = `_slice-${ctx.name}-${crypto.randomUUID()}`;
  createArrayTable(ctx.db, sliceName);
  const len = length(ctx);

  // Handle negative indices
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

  ctx.db.run<[number, number, number]>(
    `INSERT INTO "${sliceName}" SELECT (id - ?) as id, value FROM "${ctx.name}" WHERE id >= ? AND id < ?`,
    [offset, startId, endId]
  );

  return sliceName;
};

export const splice = (
  ctx: JsoliteArrayContext,
  start: number,
  deleteCount?: number,
  ...items: any[]
) => {
  if (typeof deleteCount !== "number" && items && items.length > 0) {
    throw new Error("deleteCount is required if items are provided");
  }
  if (typeof deleteCount === "number" && deleteCount < 0) {
    throw new Error("deleteCount cannot be negative");
  }
  const removed = slice(
    ctx,
    start,
    typeof deleteCount === "number" ? start + deleteCount : undefined
  );

  if (typeof deleteCount === "number" && deleteCount > 0) {
    ctx.queries.deleteRange.run(start + 1, start + deleteCount + 1);
  } else if (typeof deleteCount !== "number") {
    ctx.queries.deleteGte.run(start + 1);
  }

  let shiftOffset = items.length - (deleteCount ?? 0);

  if (shiftOffset < 0) {
    ctx.queries.shiftIndicesGte.run(shiftOffset, start + 1);
  } else if (shiftOffset > 0) {
    const len = length(ctx);
    shiftOffset = shiftOffset + len - start - 1;
    ctx.queries.shiftIndicesGte.run(shiftOffset, start + 1);
    shiftOffset = len - start - 1;
  }
  for (let i = 0; i < items.length; i++) {
    ctx.queries.insertAt.run(start + i + 1, JSON.stringify(items[i]));
  }

  if (shiftOffset > 0) {
    ctx.queries.shiftIndicesGte.run(-shiftOffset, start + items.length + 1);
  }

  return removed;
};

export const rename = (ctx: JsoliteArrayContext, newName: string) => {
  ctx.db.exec(`ALTER TABLE "${ctx.name}" RENAME TO "${newName}"`);
};

export const drop = (ctx: JsoliteArrayContext) => {
  ctx.db.exec(`DROP TABLE "${ctx.name}"`);
};

export const empty = (ctx: JsoliteArrayContext) => {
  ctx.db.exec(`DELETE FROM "${ctx.name}"`);
};

export const filter = (
  ctx: JsoliteArrayContext,
  predicate: (item: any) => boolean
) => {
  const filteredName = `_slice-${ctx.name}-${crypto.randomUUID()}`;
  createArrayTable(ctx.db, filteredName);
  const n = length(ctx);
  for (let i = 0; i < n; i++) {
    const item = at(ctx, i);
    if (predicate(item)) {
      ctx.db.run(
        `INSERT INTO "${filteredName}" (value) VALUES ((SELECT value FROM "${ctx.name}" WHERE id = ?))`,
        [i + 1]
      );
    }
  }
  return filteredName;
};

export const sort = <T>(
  ctx: JsoliteArrayContext,
  compare: (a: T, b: T) => number
) => {
  let moved = false;
  const n = length(ctx);

  do {
    moved = false;
    for (let i = 0; i < n - 1; i++) {
      const a = at(ctx, i);
      const b = at(ctx, i + 1);
      const cmp = compare(a, b);
      if (cmp > 0) {
        set(ctx, i + 1, a);
        set(ctx, i, b);
        moved = true;
      }
    }
  } while (moved);
};

export const some = <T>(
  ctx: JsoliteArrayContext,
  predicate: (item: T) => boolean
) => {
  const n = length(ctx);

  for (let i = 0; i < n; i++) {
    const item = at(ctx, i);
    if (predicate(item)) {
      return true;
    }
  }

  return false;
};

export const every = <T>(
  ctx: JsoliteArrayContext,
  predicate: (item: T) => boolean
) => {
  return !some<T>(ctx, (item) => !predicate(item));
};

export const map = <R, T>(
  ctx: JsoliteArrayContext,
  callback: (item: T) => R
) => {
  const mappedName = `_slice-${ctx.name}-${crypto.randomUUID()}`;
  createArrayTable(ctx.db, mappedName);
  const n = length(ctx);
  for (let i = 0; i < n; i++) {
    const item = at(ctx, i);
    ctx.db.run(`INSERT INTO "${mappedName}" (value) VALUES (?)`, [
      JSON.stringify(callback(item)),
    ]);
  }
  return mappedName;
};

export const reduce = <T, R>(
  ctx: JsoliteArrayContext,
  callback: (accumulator: R, item: T, index: number) => R,
  initial: R
) => {
  const n = length(ctx);
  let acc = initial;

  for (let i = 0; i < n; i++) {
    const item = at(ctx, i);
    acc = callback(acc, item, i);
  }

  return acc;
};

export const reduceRight = <T, R>(
  ctx: JsoliteArrayContext,
  callback: (accumulator: R, item: T, index: number) => R,
  initial: R
) => {
  const n = length(ctx);
  let acc = initial;

  for (let i = n - 1; i >= 0; i--) {
    const item = at(ctx, i);
    acc = callback(acc, item, i);
  }

  return acc;
};

export const find = <T>(
  ctx: JsoliteArrayContext,
  predicate: (item: T) => boolean
) => {
  const n = length(ctx);

  for (let i = 0; i < n; i++) {
    const item = at(ctx, i);
    if (predicate(item)) {
      return item as T;
    }
  }

  return undefined;
};

export const reverse = (ctx: JsoliteArrayContext) => {
  const n = length(ctx);
  for (let i = 0; i <= Math.floor(n / 2); i++) {
    const a = at(ctx, i);
    const b = at(ctx, n - i - 1);
    set(ctx, i, b);
    set(ctx, n - i - 1, a);
  }
};

export const forEach = <T>(
  ctx: JsoliteArrayContext,
  callback: (item: T, index: number) => void
) => {
  const n = length(ctx);

  for (let i = 0; i < n; i++) {
    const item = at(ctx, i);
    callback(item, i);
  }
};

export const findIndex = <T>(
  ctx: JsoliteArrayContext,
  predicate: (item: T) => boolean
) => {
  const n = length(ctx);

  for (let i = 0; i < n; i++) {
    const item = at(ctx, i);
    if (predicate(item)) {
      return i;
    }
  }

  return undefined;
};

export const array = <T extends any>(db: Database, name: string) => {
  let ctx = init(db, name);
  return {
    get name() {
      return ctx.name;
    },
    push: (...items: T[]) => push(ctx, ...items),
    get length() {
      return length(ctx);
    },
    at: (index: number) => at(ctx, index) as T | null,
    pop: () => pop(ctx),
    shift: () => shift(ctx),
    unshift: (...items: T[]) => unshift(ctx, ...items),
    set: (index: number, value: T) => set(ctx, index, value),
    slice: (start?: number, end?: number) => {
      return array(ctx.db, slice(ctx, start, end));
    },
    splice: (start: number, deleteCount?: number, ...items: T[]) => {
      return array(ctx.db, splice(ctx, start, deleteCount, ...items));
    },
    filter: (predicate: (item: T) => boolean) => {
      return array(ctx.db, filter(ctx, predicate));
    },
    sort(compare: (a: T, b: T) => number) {
      sort(ctx, compare);

      return this;
    },
    some(predicate: (item: T) => boolean) {
      return some(ctx, predicate);
    },
    every(predicate: (item: T) => boolean) {
      return every(ctx, predicate);
    },
    map: <R>(callback: (item: T) => R) => {
      return array(ctx.db, map(ctx, callback));
    },
    reduce: <R>(
      callback: (accumulator: R, item: T, index: number) => R,
      initial: R
    ) => {
      return reduce(ctx, callback, initial);
    },
    reduceRight: <R>(
      callback: (accumulator: R, item: T, index: number) => R,
      initial: R
    ) => {
      return reduceRight(ctx, callback, initial);
    },
    find(predicate: (item: T) => boolean) {
      return find(ctx, predicate);
    },
    findIndex(predicate: (item: T) => boolean) {
      return findIndex(ctx, predicate);
    },
    reverse() {
      reverse(ctx);
      return this;
    },
    forEach(callback: (item: T, index: number) => void) {
      forEach(ctx, callback);
    },
    rename: (newName: string) => {
      rename(ctx, newName);
      Object.values(ctx.queries).forEach((query) => {
        query.finalize();
      });
      ctx = init(ctx.db, newName);
    },
    drop: () => {
      drop(ctx);
      Object.values(ctx.queries).forEach((query) => {
        query.finalize();
      });
    },
    empty: () => {
      empty(ctx);
    },
    debug: () => {
      console.log(ctx.queries.selectAll.all());
    },
    toJsArray: () =>
      ctx.queries.selectAll.all().map((row) => JSON.parse(row.value)),
  };
};
