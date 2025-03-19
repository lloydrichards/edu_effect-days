import { BunRuntime } from "@effect/platform-bun";
import Sqlite from "better-sqlite3";
import { Effect, Schema, Stream } from "effect";

export class SqlClient extends Effect.Service<SqlClient>()("SqlClient", {
  scoped: Effect.gen(function* () {
    const db = yield* Effect.acquireRelease(
      Effect.sync(() => new Sqlite(":memory:")),
      (db) => Effect.sync(() => db.close()),
    );

    const use = Effect.fn("SqlClient.use")(
      <A>(f: (db: Sqlite.Database) => A): Effect.Effect<A, SqlError> =>
        Effect.try({
          try: () => f(db),
          catch: (cause) => new SqlError({ cause }),
        }),
    );

    const query = <A = unknown>(
      sql: string,
      ...params: Array<any>
    ): Effect.Effect<Array<A>, SqlError> =>
      use((db) => {
        const stmt = db.prepare<Array<any>, A>(sql);
        if (stmt.reader) {
          return stmt.all(...params) ?? [];
        }
        stmt.run(...params);
        return [];
      }).pipe(Effect.withSpan("SqlClient.query", { attributes: { sql } }));

    // TODO: Add a `stream` method that returns a `Stream` of results
    //
    // hint: statements have an .iterate() api

    const stream = <A>(sql: string, ...params: Array<any>) =>
      use((db) => {
        const stmt = db.prepare<Array<any>, A>(sql);
        return Stream.fromIterable(stmt.iterate(...params));
      }).pipe(Stream.unwrap);

    return {
      use,
      query,
      stream,
    } as const;
  }),
}) {}

export class SqlError extends Schema.TaggedError<SqlError>()("SqlError", {
  cause: Schema.Defect,
}) {}

// usage

Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql.query("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
  for (let i = 0; i < 30; i++) {
    yield* sql.query("INSERT INTO users (name) VALUES (?)", `User ${i}`);
  }

  yield* sql
    .stream<{ id: number; name: string }>("SELECT * FROM users")
    .pipe(Stream.runForEach(Effect.log));
}).pipe(Effect.provide(SqlClient.Default), BunRuntime.runMain);
