# bundb

persisted javascript constructs built on the bun runtime

## Map

```ts
import bundb from "bundb";

const db = bundb(":memory:"); // or supply sqlite file path

// supply a persistence key
const users = db.map("users");
// alternatively, create a persistent map from an existing vanilla map
const users = db.mapFrom(vanillaUsersMap, "users");

const joe = users.get("joe");
const hasJerry = users.has("jerry");

users.set("jerry", {
  name: "jerry",
  age: 34,
});

users.delete("joe");
// with types
const users = db.map<
  string,
  {
    name: string;
    age: 34;
  }
>("users");

// db level hooks
const unsubscribe = db.on("map.set", ({ map, key, value }) => {
  // do stuff
});

unsubcribe();

// map level hooks
users.$on(...)

// db level intercepts
db.intercept("map.set", ({ map, key, value }) => {
  if (key === "cat") {
    return "moose";
  }
});

// map level intercepts
users.$intercept(...)

```

## Array

```ts
import bundb from "bundb";

const db = bundb(":memory:");

const todos = db.array("todos");

//push
const i = todos.push("go for a run");
//index access
const todo = todos[i];
// at
const todoAt = todos.at(i);
// slice clones* the section of the array data. bundb will not actually clone the data until a write operation is performed on the slice. read more about slices below.
const todosSlice = todos.slice(...)
// don't forget to cleanup!
todosSlice.$drop()
// I want to keep the slice around!
todosSlice.$rename("sub-todos")
// woops, forgot to cleanup a bunch of slices from earlier.
db.$dropUnamedSlices("todos")
// splice
todos.splice(...)
// filter. returns a slice.
const doneTodos = todos.filter((item) => item.done);
// every
const allDone = todos.every((item) => item.done)
// some
const haveWork = todos.some((item) => item.assignee === "me")
// forEach
todos.forEach((todo)=> {
    // this will persist
    todo.done = true
})
// find
const runningTodo = todos.find((todo)=> todo.title === "run");
// this will persist
runningTodo.done = true;
// concat. returns a slice.
const todaysTodos = db.arrayFrom([{ title: "run" }, { title: "clean" }])
const tomorrowsTodos = db.arrayFrom([{ title: "work"}, { title: "buy toilet paper" }])
const allTodos = tomorrowsTodos.concat(todaysTodos);

// reduce
const totalTimeSpent = todos.reduce((acc, todo) => acc + todo.timeSpent, 0)
// shift/unshift. the returned item is no longer persisted.
const archived = todos.shift()
// this will NOT persist. the todo object is removed from the db.
archived.done = true;

// sort. sorts the array in place, just like a vanilla array.
const byTimeSpent = todos.sort((a, b)=> a.timeSpent - b.timeSpent)
```

## Slices
