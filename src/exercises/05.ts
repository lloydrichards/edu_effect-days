import { BunRuntime } from "@effect/platform-bun";
import Sqlite from "better-sqlite3";
import { Effect, Schema } from "effect";

export class SqlClient extends Effect.Service<SqlClient>()("SqlClient", {
  scoped: Effect.Do.pipe(
    Effect.bind("db", () =>
      Effect.acquireRelease(
        Effect.sync(() => Sqlite(":memory:")),
        (db) => Effect.sync(() => db.close()),
      ),
    ),
    Effect.bind("use", ({ db }) =>
      Effect.succeed(
        <A>(f: (db: Sqlite.Database) => A): Effect.Effect<A, SqlError> =>
          Effect.try({
            try: () => f(db),
            catch: (cause) => new SqlError({ cause }),
          }),
      ),
    ),
    Effect.bind("query", ({ use }) =>
      Effect.succeed(<A = unknown>(sql: string, ...params: Array<any>) =>
        use((db) => {
          const stmt = db.prepare<Array<any>, A>(sql);
          if (stmt.reader) {
            return stmt.all(...params) ?? [];
          }
          stmt.run(...params);
          return [];
        }),
      ),
    ),
  ),
}) {}

export class SqlError extends Schema.TaggedError<SqlError>()("SqlError", {
  cause: Schema.Defect,
}) {}

// usage

Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql.query("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
  yield* sql.query("INSERT INTO users (name) VALUES (?)", "Alice");

  const users = yield* sql.query<{ id: number; name: string }>(
    "SELECT * FROM users",
  );

  yield* Effect.log(users);
}).pipe(Effect.provide(SqlClient.Default), BunRuntime.runMain);
