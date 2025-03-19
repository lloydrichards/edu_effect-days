import { Effect } from "effect";
import { Channel, Misbehavior, Pun } from "./shared/domain/models";
import { PunsterClient } from "./shared/services/PunsterClient";
import { describe, expect, it } from "vitest";

/**
 * You are working on writing tests for the `PunsterClient` and want to
 * provide a mock implementation of the client to your tests that returns
 * static data.
 *
 * **Todo List**:
 *   - Write a mock implementation of the `PunsterClient` which
 *     - Always returns the `testPun` from `createPun`
 *     - Always returns the `testEvaluation` from `evaluatePun`
 *   - Provide the mock implementation to the `main` program
 */

describe("mock out PunsterClient", () => {
  const mockPun = Pun.make({
    setup: "The setup",
    punchline: "The punchline",
    groanPotential: 50,
  });

  const mockEvaluation = "Pun Evaluation Report";

  const mockClient = PunsterClient.of({
    createPun: () => Effect.succeed(mockPun),
    evaluatePun: () => Effect.succeed(mockEvaluation),
  });

  const mockMisbehavior = Misbehavior.make({
    childName: "Testy McTesterson",
    category: "TestCategory",
    description: "A test misbehavior",
    severity: 1,
  });

  it("should return the test pun", async () => {
    const result = await Effect.runPromise(
      PunsterClient.pipe(
        Effect.andThen(({ createPun }) => createPun(mockMisbehavior)),
      ).pipe(Effect.provideService(PunsterClient, mockClient)),
    );

    expect(result).toEqual(mockPun);
  });

  it("should return the test evaluation", async () => {
    const result = await Effect.runPromise(
      Effect.Do.pipe(
        Effect.bind("client", () => PunsterClient),
        Effect.bind("pun", ({ client }) => client.createPun(mockMisbehavior)),
        Effect.andThen(({ client, pun }) =>
          client.evaluatePun(
            pun,
            mockMisbehavior,
            "TestChannel" as unknown as Channel,
          ),
        ),
      ).pipe(Effect.provideService(PunsterClient, mockClient)),
    );

    expect(result).toEqual(mockEvaluation);
  });
});
