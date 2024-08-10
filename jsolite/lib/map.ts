import { Database } from "bun:sqlite";
import { array } from "./array";

export interface JsoLiteMap<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  has(key: K): boolean;
  delete(key: K): void;
  keys(): ReturnType<typeof array<K>>;
  values(): ReturnType<typeof array<V>>;
  entries(): ReturnType<typeof array<[K, V]>>;
}

export class JsoLiteMapImpl<K, V> implements JsoLiteMap<K, V> {
  private db: Database;
  private tableName: string;
  constructor(db: Database, tableName: string) {
    this.db = db;
    this.tableName = `map-${tableName}`;
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS "${this.tableName}" (key PRIMARY KEY, value)`
    );
  }

  get(key: K): V | undefined {
    const result = this.db
      .query<{ value: string }, { $key: string }>(
        `SELECT value FROM "${this.tableName}" WHERE key = $key`
      )
      .get({ $key: JSON.stringify(key) });
    return result ? JSON.parse(result.value) : undefined;
  }

  set(key: K, value: V): void {
    this.db
      .query(
        `INSERT OR REPLACE INTO "${this.tableName}" (key, value) VALUES (?, ?)`
      )
      .run(JSON.stringify(key), JSON.stringify(value));
  }

  has(key: K): boolean {
    const result = this.db
      .query(`SELECT 1 FROM "${this.tableName}" WHERE key = ?`)
      .get(JSON.stringify(key));
    return !!result;
  }

  delete(key: K): void {
    this.db.exec(`DELETE FROM "${this.tableName}" WHERE key = ?`, [
      JSON.stringify(key),
    ]);
  }

  keys() {
    const keysArray = array<K>(
      this.db,
      `_keys-${this.tableName}-${crypto.randomUUID()}`
    );

    this.db.exec(
      `INSERT INTO "${keysArray.name}" (value) SELECT key as value FROM "${this.tableName}"`
    );

    return keysArray;
  }

  values() {
    const valuesArray = array<V>(
      this.db,
      `_values-${this.tableName}-${crypto.randomUUID()}`
    );

    this.db.exec(
      `INSERT INTO "${valuesArray.name}" (value) SELECT value FROM "${this.tableName}"`
    );

    return valuesArray;
  }

  entries() {
    const valuesArray = array<[K, V]>(
      this.db,
      `_values-${this.tableName}-${crypto.randomUUID()}`
    );

    this.db.exec(
      `INSERT INTO "${valuesArray.name}" (value) SELECT ('[' || key || ',' || value || ']') as value FROM "${this.tableName}"`
    );

    return valuesArray;
  }
}
