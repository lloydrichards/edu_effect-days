# Workshop Notes

2025-03-19

## Defining Serivces

### GenericTag (not recommended)

```ts
class CacheMissError extends Data.TaggedError("CacheMissError")<{
  readonly message: string;
}> {}

// STEP 1: Define the service identifier
interface Cache {
  readonly _: unique symbol;
}

// STEP 2: Define the service interface
interface CacheShape {
  readonly lookup: (key: string) => Effect.Effect<string, CacheMissError>;
}

// Step 3: Define the service Tag
//                       ┏━━ Requires the tag to be unique ━━━━━━┓
//                       v                                       v
const GenericCache = Context.GenericTag<Cache, CacheShape>("app/Cache");
```

### Recommended

```ts
// Define the service identifier, shape, and Tag at once
class Cache extends Context.Tag("app/Cache")<Cache, CacheShape>() {}

const program = pipe(
  Effect.succeed(42),
  Effect.tap(() => Console.info("Workshop Day!")),
);

const run = Effect.runSync(program);
```

## Providing Service

```ts
// Define the service implementation
const cacheMock = Effect.provideService(Cache, {
  lookup: (key) => {
    return Effect.succeed(`${key}-mock`);
  },
});

// Provide the service to the program
const runnable = program.pipe(cacheMock);
```

```ts
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

// Create a constructor for a `Cache` that relies on the `FileSystem`
//
//      ┌─── Effect<{ readonly lookup: ... }, never, FileSystem> ⛔
//      ▼
const makeFileSystemCache = FileSystem.pipe(
  Effect.andThen((fs) =>
    Cache.of({
      lookup: (key) =>
        fs.readFileString(`./src/demos/session-1/cache/${key}`).pipe(
          Effect.mapError(
            () =>
              new CacheMissError({
                message: `failed to read file for cache key: "${key}"`,
              }),
          ),
        ),
    }),
  ),
);
```

## Layers

```ts
//              ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Services Out
//              ┃           ┏━━━━━━━━━━━━━━━━ Errors in constructing the service
//              ┃           ┃          ┏━━━━━ Services in
// Layer<RequirementsOut, Error, RequirementsIn>

const neverFail = Layer.succeed(Cache, {
  lookup: (key) => Effect.succeed(`${key}-mock`),
});

const effectful = Layer.effect(
  Cache,
  Effect.succeed({ lookup: () => Effect.succeed("mock") }),
);
```

### Resourceful Layers

```ts
const resourcefulOperation = (key: string) =>
  Effect.acquireRelease(
    Console.log(`Acquiring ${key}`),
    // The below finalizer will be added to the `Scope`
    () => Console.log(`Releasing ${key}`),
  );

const program = pipe(
  resourcefulOperation("1"),
  Effect.flatMap(() => resourcefulOperation("2")),
  Effect.flatMap(() => resourcefulOperation("3")),
  Effect.flatMap(() => resourcefulOperation("4")),
);

const runnable = Effect.scoped(program);

const run = Effect.runSync(runnable);
```
