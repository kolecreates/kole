import { expect, test, describe } from "bun:test";
import bundb from "../index";

describe("Map", () => {
  test("basic operations", () => {
    const db = bundb(":memory:");
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

  test("mapFrom", () => {
    const db = bundb(":memory:");
    const vanillaMap = new Map([
      ["alice", { name: "Alice", age: 25 }],
      ["bob", { name: "Bob", age: 35 }],
    ]);
    const users = db.mapFrom(vanillaMap, "users");

    expect(users.get("alice")).toEqual({ name: "Alice", age: 25 });
    expect(users.get("bob")).toEqual({ name: "Bob", age: 35 });
  });

  test("hooks", () => {
    const db = bundb(":memory:");
    const users = db.map("users");
    let hookCalled = false;

    const unsubscribe = db.on("map.set", ({ map, key, value }) => {
      hookCalled = true;
      expect(map).toBe(users);
      expect(key).toBe("jerry");
      expect(value).toEqual({ name: "Jerry", age: 34 });
    });

    users.set("jerry", { name: "Jerry", age: 34 });
    expect(hookCalled).toBe(true);

    unsubscribe();
  });

  test("intercept map set", () => {
    const db = bundb(":memory:");
    const users = db.map("users");

    db.intercept("map.set", ({ map, key, value }) => {
      if (key === "cat") {
        return "moose";
      }
    });

    users.set("cat", { name: "Whiskers", age: 5 });
    users.set("dog", { name: "Fido", age: 10 });
    expect(users.get("cat")).toBe("moose");
    expect(users.get("dog")).toEqual({ name: "Fido", age: 10 });
  });

  test("intercept map get", () => {
    const db = bundb(":memory:");
    const users = db.map("users");

    users.set("alice", { name: "Alice", age: 30 });
    users.set("bob", { name: "Bob", age: 40 });

    db.intercept("map.get", ({ map, key }) => {
      if (key === "alice") {
        return { name: "Alice", age: 31 };
      }
    });

    expect(users.get("alice")).toEqual({ name: "Alice", age: 31 });
    expect(users.get("bob")).toEqual({ name: "Bob", age: 40 });
  });

  test("intercept map delete", () => {
    const db = bundb(":memory:");
    const users = db.map("users");

    users.set("bob", { name: "Bob", age: 40 });
    users.set("alice", { name: "Alice", age: 30 });

    let interceptCalled = false;
    db.intercept("map.delete", ({ map, key }) => {
      interceptCalled = true;
      if (key === "bob") {
        return false; // Prevent deletion
      }
    });

    users.delete("bob");
    users.delete("alice");
    expect(interceptCalled).toBe(true);
    expect(users.has("bob")).toBe(true);
    expect(users.has("alice")).toBe(false);
  });

  test("Map<number, number>", () => {
    const db = bundb(":memory:");
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
    const db = bundb(":memory:");
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
    const db = bundb(":memory:");
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
    const db = bundb(":memory:");
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
    const db = bundb(":memory:");
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
    const db = bundb(":memory:");
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
    const db = bundb(":memory:");
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
    const db = bundb(":memory:");
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
    const db = bundb(":memory:");
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
    const db = bundb(":memory:");
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
