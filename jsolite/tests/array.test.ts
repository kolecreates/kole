import { expect, test, describe, beforeEach, afterAll } from "bun:test";
import jsolite from "../index";

describe("Array", () => {
  test("push and index access", () => {
    const db = jsolite(":memory:");
    const todos = db.array("todos");
    const index = todos.push("go for a run");
    expect(todos[index]).toBe("go for a run");
  });

  test("index mutation", () => {
    const db = jsolite(":memory:");
    const todos = db.array("todos");
    const index = todos.push("go for a run");
    todos[index] = "go for a run!";
    expect(todos[index]).toBe("go for a run!");
  });

  test("push multiple items", () => {
    const db = jsolite(":memory:");
    const todos = db.array("todos");
    todos.push("go for a run", "clean room", "eat dinner");
    expect(todos.length).toBe(3);
  });

  test("pop", () => {
    const db = jsolite(":memory:");
    const todos = db.array("todos");
    todos.push("item1", "item2", "item3");
    const popped = todos.pop();
    expect(popped).toBe("item3");
    expect(todos.length).toBe(2);
  });

  test("shift", () => {
    const db = jsolite(":memory:");
    const todos = db.array("todos");
    todos.push("item1", "item2", "item3");
    const shifted = todos.shift();
    expect(shifted).toBe("item1");
    expect(todos.length).toBe(2);
  });

  test("unshift", () => {
    const db = jsolite(":memory:");
    const todos = db.array("todos");
    todos.push("item1", "item2");
    todos.unshift("study for test");
    expect(todos[0]).toBe("study for test");
    expect(todos.length).toBe(3);
  });

  test("hooks and intercepts", () => {
    const db = jsolite(":memory:");
    const todos = db.array("todos");
    let hookCalled = false;
    const unsubscribe = db.on("array.push", ({ array, items }) => {
      hookCalled = true;
      expect(array).toBe(todos);
      expect(items).toEqual(["new todo"]);
    });

    todos.push("new todo");
    expect(hookCalled).toBe(true);

    unsubscribe();

    db.intercept("array.push", ({ array, items }) => {
      if (items[0] === "intercepted") {
        return ["modified"];
      }
    });

    todos.push("intercepted");
    expect(todos[todos.length - 1]).toBe("modified");
  });

  test("array performance with complex objects", () => {
    const db = jsolite(":memory:");
    try {
      const perfArray = db.array<{
        id: number;
        name: string;
        data: { value: number; tags: string[] };
      }>("perfArray");
      const iterations = 100_000;

      console.time("Insert");
      db.transaction(() => {
        for (let i = 0; i < iterations; i++) {
          perfArray.push({
            id: i,
            name: `item${i}`,
            data: {
              value: Math.random() * 100,
              tags: [`tag${i % 5}`, `tag${i % 3}`],
            },
          });
        }
      })();
      console.timeEnd("Insert");

      console.time("Read");
      for (let i = 0; i < iterations; i++) {
        const item = perfArray[i];
        if (item) {
          const { id, name, data } = item;
          const { value, tags } = data;
        }
      }
      console.timeEnd("Read");

      console.time("Update");
      db.transaction(() => {
        for (let i = 0; i < iterations; i++) {
          const existingItem = perfArray[i];
          if (existingItem) {
            perfArray[i] = {
              ...existingItem,
              name: `updatedItem${i}`,
              data: {
                ...existingItem.data,
                value: Math.random() * 200,
                tags: [...existingItem.data.tags, `newTag${i % 2}`],
              },
            };
          }
        }
      })();
      console.timeEnd("Update");

      console.time("Delete");
      db.transaction(() => {
        for (let i = 0; i < iterations; i++) {
          perfArray.pop();
        }
      })();
      console.timeEnd("Delete");
    } catch (e) {
      console.error(e);
    } finally {
      db.close();
    }
  });
});
