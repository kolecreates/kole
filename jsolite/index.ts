import { Database, constants } from "bun:sqlite";

import { type JsoLiteMap, JsoLiteMapImpl } from "./lib/map";
import { array } from "./lib/array";

function jsolite(path: string) {
  const db = new Database(path);
  db.run("PRAGMA journal_mode = WAL");
  db.fileControl(constants.SQLITE_FCNTL_PERSIST_WAL, 0);
  const globalHooks = new Map<string, Set<(data: any) => void>>();
  const globalIntercepts = new Map<string, ((data: any) => any)[]>();

  return {
    [Symbol.dispose]() {
      db.close();
    },
    close() {
      db.close();
    },
    array<T>(name: string) {
      return array<T>(db, name);
    },
    arrayFrom<T>(vanillaArray: T[], name: string) {
      const array = this.array<T>(name);
      array.push(...vanillaArray);
      return array;
    },
    map<K, V>(name: string): JsoLiteMap<K, V> {
      const mapInstance = new JsoLiteMapImpl<K, V>(
        db,
        name,
        globalHooks,
        globalIntercepts
      );
      return mapInstance;
    },

    mapFrom<K, V>(vanillaMap: Map<K, V>, name: string): JsoLiteMap<K, V> {
      const jsoLiteMap = this.map<K, V>(name);
      for (const [key, value] of vanillaMap) {
        jsoLiteMap.set(key, value);
      }
      return jsoLiteMap;
    },

    on(event: string, callback: (data: any) => void): () => void {
      if (!globalHooks.has(event)) {
        globalHooks.set(event, new Set());
      }
      globalHooks.get(event)!.add(callback);
      return () => {
        globalHooks.get(event)!.delete(callback);
      };
    },

    intercept(event: string, interceptor: (data: any) => any): void {
      if (!globalIntercepts.has(event)) {
        globalIntercepts.set(event, []);
      }
      globalIntercepts.get(event)!.push(interceptor);
    },
    transaction<T extends (...args: any) => any>(cb: T): T {
      return db.transaction(cb) as unknown as T;
    },
  };
}

export default jsolite;
