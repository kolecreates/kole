import { Database } from "bun:sqlite";

import { type JsoLiteMap, JsoLiteMapImpl } from "./lib/map";
import { type JsoLiteArray, JsoLiteArrayImpl } from "./lib/array";

function jsolite(path: string) {
  const db = new Database(path);
  db.run("PRAGMA journal_mode = WAL");
  const globalHooks = new Map<string, Set<(data: any) => void>>();
  const globalIntercepts = new Map<string, ((data: any) => any)[]>();

  return {
    close() {
      db.close();
    },
    array<T>(name: string): JsoLiteArray<T> {
      const arrayInstance = JsoLiteArrayImpl.withIndexAccessSupport<T>(
        db,
        name,
        globalHooks,
        globalIntercepts
      );
      return arrayInstance;
    },
    arrayFrom<T>(vanillaArray: T[], name: string): JsoLiteArray<T> {
      const jsoliteArray = this.array<T>(name);
      jsoliteArray.push(...vanillaArray);
      return jsoliteArray;
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
