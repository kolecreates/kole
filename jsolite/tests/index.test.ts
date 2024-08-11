import { describe, expect, test } from "bun:test";
import jsolite from "../index";

describe("jsolite", () => {
  describe("listArrays", () => {
    test("empty", () => {
      const db = jsolite(":memory:");
      const list = db.listArrays();
      expect(list).toEqual([]);
    });

    test("one array", () => {
      const db = jsolite(":memory:");
      db.array("todos");
      db.map("users");
      const list = db.listArrays();
      expect(list).toEqual([{ name: "todos" }]);
    });

    test("two arrays", () => {
      const db = jsolite(":memory:");
      db.array("todos");
      db.array("users");
      const list = db.listArrays();
      expect(list).toEqual([{ name: "todos" }, { name: "users" }]);
    });

    test("unnamed array", () => {
      const db = jsolite(":memory:");
      db.array<{ id: string }>("todos").filter(({ id }) => id === "1");
      const list = db.listArrays();
      expect(list[0].name).toEqual("todos");
      expect(list[1].name.startsWith("__unnamed-todos-")).toBe(true);
    });
  });

  describe("listMaps", () => {
    test("empty", () => {
      const db = jsolite(":memory:");
      const list = db.listMaps();
      expect(list).toEqual([]);
    });

    test("one map", () => {
      const db = jsolite(":memory:");
      db.map("users");
      const list = db.listMaps();
      expect(list).toEqual([{ name: "users" }]);
    });

    test("two maps", () => {
      const db = jsolite(":memory:");
      db.map("users");
      db.map("todos");
      const list = db.listMaps();
      expect(list).toEqual([{ name: "users" }, { name: "todos" }]);
    });
  });

  describe("list records", () => {
    test("empty", () => {
      const db = jsolite(":memory:");
      const list = db.listRecords();
      expect(list).toEqual([]);
    });

    test("one record", () => {
      const db = jsolite(":memory:");
      db.record("users");
      const list = db.listRecords();
      expect(list).toEqual([{ name: "users" }]);
    });

    test("two records", () => {
      const db = jsolite(":memory:");
      db.record("users");
      db.record("todos");
      const list = db.listRecords();
      expect(list).toEqual([{ name: "users" }, { name: "todos" }]);
    });
  });

  test("list maps, arrays, and records", () => {
    const db = jsolite(":memory:");
    db.map("users");
    db.array("todos");
    db.record("config");
    const listMaps = db.listMaps();
    const listArrays = db.listArrays();
    const listRecords = db.listRecords();
    expect(listMaps).toEqual([{ name: "users" }]);
    expect(listArrays).toEqual([{ name: "todos" }]);
    expect(listRecords).toEqual([{ name: "config" }]);
  });
});
