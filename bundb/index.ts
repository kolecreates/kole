import { Database } from "bun:sqlite";

import { type BunDBMap, BunDBMapImpl } from "./lib/map";
import { type BunDBArray, BunDBArrayImpl } from "./lib/array";

function bundb(path: string) {
  const db = new Database(path);
  const globalHooks = new Map<string, Set<(data: any) => void>>();
  const globalIntercepts = new Map<string, ((data: any) => any)[]>();

  return {
    close() {
      db.close();
    },
    array<T>(name: string): BunDBArray<T> {
      const arrayInstance = BunDBArrayImpl.withIndexAccessSupport<T>(
        db,
        name,
        globalHooks,
        globalIntercepts
      );
      return arrayInstance;
    },
    arrayFrom<T>(vanillaArray: T[], name: string): BunDBArray<T> {
      const bunDBArray = this.array<T>(name);
      bunDBArray.push(...vanillaArray);
      return bunDBArray;
    },
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
