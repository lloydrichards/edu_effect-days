import { BunRuntime } from "@effect/platform-bun";
import Sqlite from "better-sqlite3";
import {
  Cause,
  Effect,
  Exit,
  FiberId,
  FiberSet,
  Layer,
  pipe,
  Schema,
  Scope,
  Stream,
} from "effect";
import express from "express";

// TODO list:
//
// 1. Wrap express app with Effect, without changing any the request handlers
// 2. Add an route for updating a user by id, using a Effect request handler
//   2.1. Use `SqlClient` from previous exercise to interact with sqlite database
// 3. Convert the existing request handlers to use Effect
//
// Optional challenges:
//
// - Add error handling to return 500 status code on database errors, and log
//   the errors
//   - Return 404 status code when a user is not found
//
// - Add tracing spans for each request
//
// - Parse the request parameters using "effect/Schema"
//   - Encode the responses using "effect/Schema"
//
// - Migrate to `HttpApi` from "@effect/platform"
//
// Advanced challenges:
//
// - Create a SqlClient .withTransaction method, and use it for the POST /users
//   route
//   - Bonus points if it supports nested transactions with savepoints
//

// setup sqlite

const db = new Sqlite(":memory:");
db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
for (let i = 0; i < 30; i++) {
  db.prepare("INSERT INTO users (name) VALUES (?)").run(`User ${i}`);
}

export class SqlError extends Schema.TaggedError<SqlError>()("SqlError", {
  cause: Schema.Defect,
}) {}

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

    const stream = <A = unknown>(
      sql: string,
      ...params: Array<any>
    ): Stream.Stream<A, SqlError> =>
      use((db) => {
        const stmt = db.prepare<Array<any>, A>(sql);
        return Stream.fromIterable(stmt.iterate(...params));
      }).pipe(
        Stream.unwrap,
        Stream.withSpan("SqlClient.stream", { attributes: { sql } }),
      );

    return {
      use,
      query,
      stream,
    } as const;
  }),
}) {}

class ExpressApp extends Effect.Service<ExpressApp>()("ExpressApp", {
  scoped: Effect.gen(function* () {
    const app = express();
    const scope = yield* Effect.scope;

    yield* Effect.acquireRelease(
      Effect.sync(() => app.listen(3000)),
      (server) =>
        Effect.async((resume) => {
          server.close(() => resume(Effect.void));
        }),
    );

    const addRoute = <E, R>(
      method: "get" | "post" | "put" | "delete",
      path: string,
      handler: (
        req: express.Request,
        res: express.Response,
      ) => Effect.Effect<void, E, R>,
    ): Effect.Effect<void, never, R> =>
      Effect.gen(function* () {
        const runFork = yield* FiberSet.makeRuntime<R>().pipe(
          Scope.extend(scope),
        );

        app[method](path, (req, res) => {
          const fiber = handler(req, res).pipe(
            Effect.withSpan(`Express.route(${method}, ${path})`),
            Effect.onExit((exit) => {
              if (!res.headersSent) {
                res.writeHead(Exit.isSuccess(exit) ? 204 : 500);
              }
              if (!res.writableEnded) {
                res.end();
              }
              if (
                Exit.isFailure(exit) &&
                !Cause.isInterruptedOnly(exit.cause)
              ) {
                return Effect.annotateLogs(
                  Effect.logWarning("Unhandled error in route", exit.cause),
                  {
                    method,
                    path,
                    headers: req.headers,
                  },
                );
              }
              return Effect.void;
            }),
            runFork,
          );

          // if the request is closed, interrupt the fiber
          req.on("close", () => {
            fiber.unsafeInterruptAsFork(FiberId.none);
          });
        });
      });

    return { app, addRoute } as const;
  }),
}) {}

// setup express

const ExistingRoutes = Effect.Do.pipe(
  Effect.bind("app", () => ExpressApp),
  Effect.bind("db", () => SqlClient),
  Effect.tap(({ app, db }) => {
    // GET: /users
    app.addRoute("get", "/users", (_req, res) =>
      db.query("SELECT * FROM users").pipe(Effect.andThen(res.json)),
    );

    // POST: /users/:id
    app.addRoute("post", "/users", (req, res) =>
      pipe(
        req.body?.name,
        Effect.fromNullable,
        Effect.flatMap((name) =>
          db.query("INSERT INTO users (name) VALUES (?)", name),
        ),
        Effect.flatMap((id) =>
          db.query("SELECT * FROM users WHERE id = ?", id),
        ),
        Effect.flatMap((user) => Effect.succeed(res.json(user))),
      ),
    );

    // GET: /users/:id
    app.addRoute("get", "/users/:id", (req, res) =>
      pipe(
        req.params.id,
        Effect.fromNullable,
        Effect.flatMap((id) =>
          db.query("SELECT * FROM users WHERE id = ?", id),
        ),
        Effect.flatMap((user) => {
          if (!user) {
            return Effect.succeed(res.status(404).end());
          }
          return Effect.succeed(res.json(user));
        }),
      ),
    );
  }),
);

const API = Layer.scopedDiscard(
  ExistingRoutes.pipe(
    Effect.tap(({ app }) =>
      app.addRoute("get", "/health", (_req, res) =>
        Effect.succeed(res.json({ status: "ok" })),
      ),
    ),
    Effect.andThen(({ app }) => app.app.listen(3000)),
    Effect.andThen(() =>
      Effect.log("Server listening on http://localhost:3000"),
    ),
  ),
).pipe(Layer.provide([SqlClient.Default, ExpressApp.Default]));

// run the API
API.pipe(Layer.launch, BunRuntime.runMain);
