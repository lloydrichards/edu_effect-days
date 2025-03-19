import { Console, Context, Data, Effect, Layer, pipe } from "effect";

const program = Effect.succeed([]);

const run = Effect.runSync(program);
