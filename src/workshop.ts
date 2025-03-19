// 2025-03-19 Workshop

import { Console, Context, Data, Effect, pipe } from "effect";

// Services in Effect

// GenericTag ( not recommended)

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

// Define the service identifier, shape, and Tag at once
class Cache extends Context.Tag("app/Cache")<
  Cache,
  {
    readonly lookup: (key: string) => Effect.Effect<string, CacheMissError>;
  }
>() {}

const program = pipe(
  Effect.succeed(42),
  Effect.tap(() => Console.info("Workshop Day!"))
);

const run = Effect.runSync(program);
