import { expect, test, describe } from "bun:test";
import jsolite from "../index";

describe("Map", () => {
  test("basic operations", () => {
    const db = jsolite(":memory:");
    const users = db.map("users");

    // Test set and get
    users.set("joe", { name: "Joe", age: 30 });
    expect(users.get("joe")).toEqual({ name: "Joe", age: 30 });

    // Test has
    expect(users.has("joe")).toBe(true);
    expect(users.has("jerry")).toBe(false);

    // Test delete
    users.delete("joe");
    expect(users.has("joe")).toBe(false);
  });

  describe("keys", () => {
    test("returns jsolite array", () => {
      const db = jsolite(":memory:");
      const vanillaMap = new Map([
        ["alice", { name: "Alice", age: 25 }],
        ["bob", { name: "Bob", age: 35 }],
      ]);
      const users = db.mapFrom(vanillaMap, "users");

      const keys = users.keys();

      expect(keys.at(0)).toBe("alice");
      expect(keys.length).toBe(2);
      keys.drop();
    });
  });

  describe("values", () => {
    test("returns jsolite array", () => {
      const db = jsolite(":memory:");
      const vanillaMap = new Map([
        ["alice", { name: "Alice", age: 25 }],
        ["bob", { name: "Bob", age: 35 }],
      ]);
      const users = db.mapFrom(vanillaMap, "users");

      const values = users.values();

      expect(values.at(0)).toEqual({ name: "Alice", age: 25 });
      expect(values.length).toBe(2);
      values.drop();
    });
  });

  describe("entries", () => {
    test("returns jsolite array", () => {
      const db = jsolite(":memory:");
      const originalEntries: any[] = [
        ["alice", { name: "Alice", age: 25 }],
        ["bob", { name: "Bob", age: 35 }],
      ];
      const vanillaMap = new Map(originalEntries);
      const users = db.mapFrom(vanillaMap, "users");

      const entries = users.entries();

      expect(entries.toJsArray()).toEqual(originalEntries);
      entries.drop();
    });
  });

  test("mapFrom", () => {
    const db = jsolite(":memory:");
    const vanillaMap = new Map([
      ["alice", { name: "Alice", age: 25 }],
      ["bob", { name: "Bob", age: 35 }],
    ]);
    const users = db.mapFrom(vanillaMap, "users");

    expect(users.get("alice")).toEqual({ name: "Alice", age: 25 });
    expect(users.get("bob")).toEqual({ name: "Bob", age: 35 });
  });

  test("Map<number, number>", () => {
    const db = jsolite(":memory:");
    const numMap = db.map<number, number>("numMap");

    numMap.set(1, 100);
    numMap.set(2, 200);

    expect(numMap.get(1)).toBe(100);
    expect(numMap.get(2)).toBe(200);
    expect(numMap.has(1)).toBe(true);
    expect(numMap.has(3)).toBe(false);

    numMap.delete(1);
    expect(numMap.has(1)).toBe(false);
  });

  test("Map<number, string>", () => {
    const db = jsolite(":memory:");
    const numStrMap = db.map<number, string>("numStrMap");

    numStrMap.set(1, "one");
    numStrMap.set(2, "two");

    expect(numStrMap.get(1)).toBe("one");
    expect(numStrMap.get(2)).toBe("two");
    expect(numStrMap.has(1)).toBe(true);
    expect(numStrMap.has(3)).toBe(false);

    numStrMap.delete(1);
    expect(numStrMap.has(1)).toBe(false);
  });

  test("Map<string, number>", () => {
    const db = jsolite(":memory:");
    const strNumMap = db.map<string, number>("strNumMap");

    strNumMap.set("one", 1);
    strNumMap.set("two", 2);

    expect(strNumMap.get("one")).toBe(1);
    expect(strNumMap.get("two")).toBe(2);
    expect(strNumMap.has("one")).toBe(true);
    expect(strNumMap.has("three")).toBe(false);

    strNumMap.delete("one");
    expect(strNumMap.has("one")).toBe(false);
  });

  test("Map<string, string>", () => {
    const db = jsolite(":memory:");
    const strStrMap = db.map<string, string>("strStrMap");

    strStrMap.set("hello", "world");
    strStrMap.set("foo", "bar");

    expect(strStrMap.get("hello")).toBe("world");
    expect(strStrMap.get("foo")).toBe("bar");
    expect(strStrMap.has("hello")).toBe(true);
    expect(strStrMap.has("baz")).toBe(false);

    strStrMap.delete("hello");
    expect(strStrMap.has("hello")).toBe(false);
  });

  test("Map<string, boolean>", () => {
    const db = jsolite(":memory:");
    const strBoolMap = db.map<string, boolean>("strBoolMap");

    strBoolMap.set("isActive", true);
    strBoolMap.set("isAdmin", false);

    expect(strBoolMap.get("isActive")).toBe(true);
    expect(strBoolMap.get("isAdmin")).toBe(false);
    expect(strBoolMap.has("isActive")).toBe(true);
    expect(strBoolMap.has("isGuest")).toBe(false);

    strBoolMap.delete("isActive");
    expect(strBoolMap.has("isActive")).toBe(false);
  });

  test("Map<number, boolean>", () => {
    const db = jsolite(":memory:");
    const numBoolMap = db.map<number, boolean>("numBoolMap");

    numBoolMap.set(1, true);
    numBoolMap.set(2, false);

    expect(numBoolMap.get(1)).toBe(true);
    expect(numBoolMap.get(2)).toBe(false);
    expect(numBoolMap.has(1)).toBe(true);
    expect(numBoolMap.has(3)).toBe(false);

    numBoolMap.delete(1);
    expect(numBoolMap.has(1)).toBe(false);
  });

  test("Map<object, string>", () => {
    const db = jsolite(":memory:");
    const objStrMap = db.map<object, string>("objStrMap");

    const key1 = { id: 1, name: "Alice" };
    const key2 = { id: 2, name: "Bob" };

    objStrMap.set(key1, "value1");
    objStrMap.set(key2, "value2");

    expect(objStrMap.get(key1)).toBe("value1");
    expect(objStrMap.get(key2)).toBe("value2");
    expect(objStrMap.has(key1)).toBe(true);
    expect(objStrMap.has({ id: 3, name: "Charlie" })).toBe(false);

    objStrMap.delete(key1);
    expect(objStrMap.has(key1)).toBe(false);
  });

  test("Map<object, number>", () => {
    const db = jsolite(":memory:");
    const objNumMap = db.map<object, number>("objNumMap");

    const key1 = { x: 10, y: 20 };
    const key2 = { x: 30, y: 40 };

    objNumMap.set(key1, 100);
    objNumMap.set(key2, 200);

    expect(objNumMap.get(key1)).toBe(100);
    expect(objNumMap.get(key2)).toBe(200);
    expect(objNumMap.has(key1)).toBe(true);
    expect(objNumMap.has({ x: 50, y: 60 })).toBe(false);

    objNumMap.delete(key2);
    expect(objNumMap.has(key2)).toBe(false);
  });

  test("Map<object, object>", () => {
    const db = jsolite(":memory:");
    const objObjMap = db.map<object, object>("objObjMap");

    const key1 = { type: "user", id: 1 };
    const key2 = { type: "post", id: 2 };
    const value1 = { name: "John Doe", age: 30 };
    const value2 = { title: "Hello World", content: "Lorem ipsum" };

    objObjMap.set(key1, value1);
    objObjMap.set(key2, value2);

    expect(objObjMap.get(key1)).toEqual(value1);
    expect(objObjMap.get(key2)).toEqual(value2);
    expect(objObjMap.has(key1)).toBe(true);
    expect(objObjMap.has({ type: "comment", id: 3 })).toBe(false);

    objObjMap.delete(key1);
    expect(objObjMap.has(key1)).toBe(false);
  });

  test("Map performance", () => {
    const db = jsolite(":memory:");
    const perfMap = db.map<number, string>("perfMap");
    const iterations = 10000;

    console.time("Insert");
    db.transaction(() => {
      for (let i = 0; i < iterations; i++) {
        perfMap.set(i, `value${i}`);
      }
    })();
    console.timeEnd("Insert");

    console.time("Read");
    for (let i = 0; i < iterations; i++) {
      perfMap.get(i);
    }
    console.timeEnd("Read");

    console.time("Update");
    db.transaction(() => {
      for (let i = 0; i < iterations; i++) {
        perfMap.set(i, `updatedValue${i}`);
      }
    })();
    console.timeEnd("Update");

    console.time("Delete");
    db.transaction(() => {
      for (let i = 0; i < iterations; i++) {
        perfMap.delete(i);
      }
    })();
    console.timeEnd("Delete");

    // Verify the map is empty after deletions
    expect(perfMap.has(0)).toBe(false);
    expect(perfMap.has(iterations - 1)).toBe(false);
  });
});
