import { Console, Effect, pipe } from "effect";

const program = pipe(
  Effect.succeed(42),
  Effect.tap(() => Console.info("Scratch!")),
);

const run = Effect.runSync(program);
