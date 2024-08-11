import { Database, constants } from "bun:sqlite";

import { JsoLiteMap } from "./lib/map";
import { JsoliteArray } from "./lib/array";
import { record } from "./lib/record";

function jsolite(path: string) {
  const db = new Database(path);
  db.run("PRAGMA journal_mode = WAL");
  db.fileControl(constants.SQLITE_FCNTL_PERSIST_WAL, 0);

  return {
    [Symbol.dispose]() {
      db.close();
    },
    close() {
      db.close();
    },
    array<T>(name: string) {
      return new JsoliteArray<T>(db, name);
    },
    arrayFrom<T>(vanillaArray: T[], name: string) {
      const array = this.array<T>(name);
      array.push(...vanillaArray);
      return array;
    },
    map<K, V>(name: string) {
      return new JsoLiteMap<K, V>(db, name);
    },
    mapFrom<K, V>(vanillaMap: Map<K, V>, name: string): JsoLiteMap<K, V> {
      const jsoLiteMap = this.map<K, V>(name);
      for (const [key, value] of vanillaMap) {
        jsoLiteMap.set(key, value);
      }
      return jsoLiteMap;
    },
    record<T extends Record<string, any>>(name: string) {
      return record<T>(db, name);
    },
    recordFrom<T extends Record<string, any>>(vanillaObject: T, name: string) {
      const jsoLiteObject = this.record<T>(name);
      for (const [key, value] of Object.entries(vanillaObject)) {
        jsoLiteObject[key as keyof T] = value;
      }
      return jsoLiteObject;
    },
    transaction<T extends (...args: any) => any>(cb: T): T {
      return db.transaction(cb) as unknown as T;
    },
    listArrays() {
      return db
        .prepare<{ name: string }, any>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' and name LIKE 'array-%'"
        )
        .all()
        .map(({ name }) => ({ name: name.replace("array-", "") }));
    },
    listMaps() {
      return db
        .prepare<{ name: string }, any>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' and name LIKE 'map-%'"
        )
        .all()
        .map(({ name }) => ({ name: name.replace("map-", "") }));
    },
    listRecords() {
      return db
        .prepare<{ name: string }, any>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' and name LIKE 'record-%'"
        )
        .all()
        .map(({ name }) => ({ name: name.replace("record-", "") }));
    },
  };
}

export default jsolite;
