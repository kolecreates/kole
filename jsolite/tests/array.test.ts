import { expect, test, describe, beforeEach, afterAll } from "bun:test";
import jsolite from "../index";

describe("Array", () => {
  describe("push", () => {
  test("then index access", () => {
    using db = jsolite(":memory:");
    const todos = db.array("todos");
    const index = todos.push("go for a run");
    expect(todos.at(index)).toBe("go for a run");
  });

  test("multiple items at once", () => {
    using db = jsolite(":memory:");
    const todos = db.array("todos");
    todos.push("go for a run", "clean room", "eat dinner");
    expect(todos.length).toBe(3);
  });

  test.skip("a lot of items", () => {
    using db = jsolite(":memory:");
    const iterations = 1_000_000;
    const todos = db.array("todos");
    for (let i = 0; i < iterations; i++) {
      todos.push(`item ${i}`);
    }
    expect(todos.length).toBe(iterations);
    });
  });

  describe("pop", () => {
    test("returns the last item", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("go for a run", "clean room", "eat dinner");
      expect(todos.pop()).toBe("eat dinner");
    });

    test("removes the last item", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("go for a run", "clean room", "eat dinner");
      todos.pop();
      expect(todos.length).toBe(2);
      expect(todos.at(1)).toBe("clean room");
    });

    test("returns undefined if the array is empty", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      expect(todos.pop()).toBe(undefined);
    });

    test.skip("a lot of items", () => {
      using db = jsolite(":memory:");
      const iterations = 1_000_000;
      const todos = db.array("todos");
      for (let i = 0; i < iterations; i++) {
        todos.push(`item ${i}`);
      }
      expect(todos.length).toBe(iterations);
      for (let i = 0; i < iterations; i++) {
        todos.pop();
      }
      expect(todos.length).toBe(0);
      expect(todos.pop()).toBe(undefined);
    });
  });

  describe("shift", () => {
    test("returns the first item", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("go for a run", "clean room", "eat dinner");
      expect(todos.shift()).toBe("go for a run");
      expect(todos.length).toBe(2);
      expect(todos.at(0)).toBe("clean room");
    });

    test("returns undefined if the array is empty", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      expect(todos.shift()).toBe(undefined);
    });
  });

  describe("unshift", () => {
    test("adds the item to the beginning", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner");
      todos.unshift("go for a run");
      expect(todos.length).toBe(2);
      expect(todos.at(0)).toBe("go for a run");
    });
    test("multiple items at once", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner");
      todos.unshift("go for a run", "clean room");
      expect(todos.length).toBe(3);
      expect(todos.at(0)).toBe("go for a run");
      expect(todos.at(1)).toBe("clean room");
      expect(todos.at(2)).toBe("eat dinner");
    });
  });

  describe("set", () => {
    test("sets the item at the given index", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner");
      todos.set(0, "go for a run");
      expect(todos.at(0)).toBe("go for a run");
    });
    test("returns the new value", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner");
      expect(todos.set(0, "go for a run")).toBe("go for a run");
    });

    test("returns undefined if the index is out of bounds", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      expect(todos.set(0, "go for a run")).toBe(undefined);
    });
  });

  describe("slice", () => {
    test("returns a new array", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner", "go for a run", "clean room");
      const slice = todos.slice(1, 2);
      expect(slice.length).toBe(1);
      expect(slice.at(0)).toBe("go for a run");
    });

    test("returns a new array with all remaining items if no end is provided", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner", "go for a run", "clean room");
      const slice = todos.slice(1);
      expect(slice.length).toBe(2);
      expect(slice.at(0)).toBe("go for a run");
      expect(slice.at(1)).toBe("clean room");
    });

    test("returns a new array with all items if neither start nor end is provided", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner", "go for a run", "clean room");
      const slice = todos.slice();
      expect(slice.length).toBe(3);
      expect(slice.at(0)).toBe("eat dinner");
      expect(slice.at(1)).toBe("go for a run");
      expect(slice.at(2)).toBe("clean room");
    });

    test("negative start index", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner", "go for a run", "clean room");
      const slice = todos.slice(-2);
      expect(slice.length).toBe(2);
      expect(slice.at(0)).toBe("go for a run");
      expect(slice.at(1)).toBe("clean room");
    });
  });

  describe("splice", () => {
    test("removes items", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner", "go for a run", "clean room");
      const removed = todos.splice(1, 1);
      expect(removed.length).toBe(1);
      expect(removed.at(0)).toBe("go for a run");
      expect(todos.length).toBe(2);
      expect(todos.at(0)).toBe("eat dinner");
      expect(todos.at(1)).toBe("clean room");
    });

    test("removes all items", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner", "go for a run", "clean room");
      const removed = todos.splice(0);
      expect(removed.length).toBe(3);
      expect(removed.at(0)).toBe("eat dinner");
      expect(removed.at(1)).toBe("go for a run");
      expect(removed.at(2)).toBe("clean room");
      expect(todos.length).toBe(0);
    });

    test("insert items", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner", "go for a run", "clean bathroom");
      const removed = todos.splice(1, 0, "clean room");
      expect(removed.length).toBe(0);
      expect(todos.length).toBe(4);
      expect(todos.at(0)).toBe("eat dinner");
      expect(todos.at(1)).toBe("clean room");
      expect(todos.at(2)).toBe("go for a run");
      expect(todos.at(3)).toBe("clean bathroom");
    });

    test("insert multiple items", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner", "go for a run", "make dinner");
      const removed = todos.splice(1, 0, "clean room", "clean bathroom");
      expect(removed.length).toBe(0);
      expect(todos.length).toBe(5);
      expect(todos.at(0)).toBe("eat dinner");
      expect(todos.at(1)).toBe("clean room");
      expect(todos.at(2)).toBe("clean bathroom");
      expect(todos.at(3)).toBe("go for a run");
      expect(todos.at(4)).toBe("make dinner");
    });

    test("delete items", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner", "go for a run", "clean room");
      const removed = todos.splice(1, 2);
      expect(removed.length).toBe(2);
      expect(removed.at(0)).toBe("go for a run");
      expect(removed.at(1)).toBe("clean room");
      expect(todos.length).toBe(1);
      expect(todos.at(0)).toBe("eat dinner");
    });

    test("delete and insert", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner", "go for a run", "clean room");
      const removed = todos.splice(1, 2, "clean bathroom");
      expect(removed.length).toBe(2);
      expect(removed.at(0)).toBe("go for a run");
      expect(removed.at(1)).toBe("clean room");
      expect(todos.length).toBe(2);
      expect(todos.at(0)).toBe("eat dinner");
      expect(todos.at(1)).toBe("clean bathroom");
    });
  });

  describe("filter", () => {
    test("returns a new array", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner", "go for a run", "clean room");
      const filtered = todos.filter((item) => item.includes("run"));
      expect(filtered.length).toBe(1);
      expect(filtered.at(0)).toBe("go for a run");
    });
  });

  describe("clear", () => {
    test("clears the array", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner", "go for a run", "clean room");
      todos.clear();
      expect(todos.length).toBe(0);

      todos.push("eat dinner", "go for a run", "clean room");
      expect(todos.length).toBe(3);
    });
  });

  describe("rename", () => {
    test("renames the array", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner", "go for a run", "clean room");
      todos.rename("tasks");
      expect(todos.length).toBe(3);
      const tasks = db.array("tasks");
      expect(tasks.length).toBe(3);
      const todos2 = db.array("todos");
      expect(todos2.length).toBe(0);
    });
  });

  describe("drop", () => {
    test("drops the array", () => {
      using db = jsolite(":memory:");
      const todos = db.array("todos");
      todos.push("eat dinner", "go for a run", "clean room");
      todos.drop();
      expect(() => todos.length).toThrow();
    });
  });
});
