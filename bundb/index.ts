import { Database } from "bun:sqlite";

import { type BunDBMap, BunDBMapImpl } from "./lib/map";

function bundb(path: string) {
  const db = new Database(path);
  const globalHooks = new Map<string, Set<(data: any) => void>>();
  const globalIntercepts = new Map<string, ((data: any) => any)[]>();

  return {
    map<K, V>(name: string): BunDBMap<K, V> {
      const mapInstance = new BunDBMapImpl<K, V>(
        db,
        name,
        globalHooks,
        globalIntercepts
      );
      return mapInstance;
    },

    mapFrom<K, V>(vanillaMap: Map<K, V>, name: string): BunDBMap<K, V> {
      const bunDBMap = this.map<K, V>(name);
      for (const [key, value] of vanillaMap) {
        bunDBMap.set(key, value);
      }
      return bunDBMap;
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

export default bundb;
