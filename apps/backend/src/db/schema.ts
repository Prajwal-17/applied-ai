import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  vector,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("Role", ["AI", "USER"]);

// export const vector = customType<{ data: number[] }>({
//   dataType() {
//     return "vector(1536)";
//   },
//   toDriver(value: number[]) {
//     return `[${value.join(",")}]`;
//   },
//   fromDriver(value: unknown) {
//     if (typeof value === "string") {
//       return JSON.parse(value);
//     }
//     return value as number[];
//   },
// });

export const chats = pgTable("Chats", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
    .defaultNow()
    .notNull(),
});

export const messages = pgTable("Messages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  chatId: text("chatId")
    .notNull()
    .references(() => chats.id),
  msgIndex: integer("msgIndex").notNull(),
  role: roleEnum("role").notNull(),
  content: text("content").notNull(),
  updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
    .defaultNow()
    .notNull(),
});

export const items = pgTable("Item", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  embedding: vector("embedding", { dimensions: 1536 }),
});
