import { describe, expect, test } from "bun:test";
import jsolite from "..";

describe("record", () => {
  test("prop get/set", () => {
    using db = jsolite(":memory:");
    const config = db.record("config");
    expect(config.systemConfig).toBeUndefined();

    config.systemOnline = true;
    config.cache = {};

    expect(config.systemOnline).toBe(true);
    expect(config.cache).toEqual({});
  });

  test("delete", ()=> {
    using db = jsolite(":memory:");
    const config = db.recordFrom({ a: 5, b: 3 }, "config");

    // @ts-ignore
    delete config.a;

    expect(config.a).toBeUndefined();
  });

  test("drop", () => {
    using db = jsolite(":memory:");
    const config = db.recordFrom({ a: 5, b: 3 }, "config");
    config.$drop();
    expect(() => config.a).toThrow();
  });

  test("rename", () => {
    using db = jsolite(":memory:");
    const config = db.recordFrom({ a: 5, b: 3 }, "config");
    config.$rename("config2");
    expect(config.a).toBe(5);
    const config2 = db.record("config2");
    expect(config2.a).toBe(5);
    expect(config2.b).toBe(3);
  });
});
