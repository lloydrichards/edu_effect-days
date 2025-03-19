import { BunRuntime } from "@effect/platform-bun";
import { Effect, Stream } from "effect";

const emitter = new EventTarget();

const onClick = Stream.asyncPush<Event>(
  Effect.fnUntraced(function* (emit) {
    function onClick(event: Event) {
      emit.single(event);
    }
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => document.removeEventListener("click", onClick)),
    );
    emitter.addEventListener("click", onClick);
  }),
);

Effect.gen(function* () {
  yield* onClick.pipe(Stream.runForEach(Effect.log), Effect.fork);
  yield* Effect.yieldNow();

  emitter.dispatchEvent(new Event("click"));
  emitter.dispatchEvent(new Event("click"));

  yield* Effect.sleep(1000);
}).pipe(BunRuntime.runMain);
