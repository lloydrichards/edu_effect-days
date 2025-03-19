import { Console, Context, Data, Effect, Layer, pipe } from "effect";

class FileReadError extends Data.TaggedError("FileReadError")<{
  readonly message: string;
}> {}

class FileSystem extends Context.Tag("app/FileSystem")<
  FileSystem,
  {
    readonly readFileString: (
      path: string,
    ) => Effect.Effect<string, FileReadError>;
  }
>() {}

class CacheMissError extends Data.TaggedError("CacheMissError")<{
  readonly message: string;
}> {}

class Cache extends Context.Tag("app/Cache")<
  Cache,
  {
    readonly lookup: (key: string) => Effect.Effect<string, CacheMissError>;
  }
>() {}

// const neverFail = Layer.succeed(Cache, {
//   lookup: (key) => Effect.succeed(`${key}-mock`),
// });

// const effectful = Layer.effect(
//   Cache,
//   Effect.succeed({ lookup: () => Effect.succeed("mock") }),
// );

const resourcefulOperation = (key: string) =>
  Effect.acquireRelease(Console.log(`Acquiring ${key}`), () =>
    Console.warn(`[release] ${key}`),
  );

const program = Effect.all([
  resourcefulOperation("1"),
  resourcefulOperation("2"),
  resourcefulOperation("3"),
  resourcefulOperation("4"),
]);

const runnable = Effect.scoped(program);

const run = Effect.runSync(runnable);
