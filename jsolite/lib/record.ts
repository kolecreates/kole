import { Database } from "bun:sqlite";

export const record = <T extends Record<any, any>>(
  db: Database,
  name: string
) => {
  let tableName = `record-${name}`;
  db.exec(
    `CREATE TABLE IF NOT EXISTS "${tableName}" (id INTEGER PRIMARY KEY, data TEXT)`
  );
  db.exec(
    `INSERT INTO "${tableName}" (id, data) VALUES (1, '{}') ON CONFLICT DO NOTHING`
  );
  return new Proxy(
    {
      $rename: (newName: string) => {
        db.exec(`ALTER TABLE "${tableName}" RENAME TO "record-${newName}"`);
        tableName = `record-${newName}`;
      },
      $drop: () => {
        db.exec(`DROP TABLE IF EXISTS "${tableName}"`);
      },
    },
    {
      get(target, prop: string, receiver: any) {
        if (prop === "$drop" || prop === "$rename") {
          return target[prop];
        }
        const row = db
          .prepare<{ data: string }, any>(
            `SELECT data FROM "${tableName}" WHERE id = 1`
          )
          .get();
        const data = row ? JSON.parse(row.data) : {};
        return data[prop];
      },
      set(target, prop: string, value: any, receiver: any) {
        return db.transaction(() => {
          const row = db
            .prepare<{ data: string }, any>(
              `SELECT data FROM "${tableName}" WHERE id = 1`
            )
            .get();
          const data = row ? JSON.parse(row.data) : {};
          data[prop] = value;
          db.run(`UPDATE "${tableName}" SET data = ? WHERE id = 1`, [
            JSON.stringify(data),
          ]);
          return true;
        })();
      },
      deleteProperty(target: any, prop: string) {
        return db.transaction(() => {
          const row = db
            .prepare<{ data: string }, any>(
              `SELECT data FROM "${tableName}" WHERE id = 1`
            )
            .get();
          const data = row ? JSON.parse(row.data) : {};
          delete data[prop];
          db.run(`UPDATE "${tableName}" SET data = ? WHERE id = 1`, [
            JSON.stringify(data),
          ]);
          return true;
        })();
      },
    }
  ) as T & {
    $drop: () => void;
    $rename: (newName: string) => void;
  };
};
