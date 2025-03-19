import { Array, Console, Effect, ManagedRuntime, pipe } from "effect";

// A pre-defined list of misbehaviors
import { misbehaviors } from "./fixtures/Misbehaviors.js";
// The tags created in the previous exercise
import { PunDistributionNetwork } from "./shared/services/PunDistributionNetwork.js";
import { PunsterClient } from "./shared/services/PunsterClient.js";
import type { Channel, Misbehavior } from "./shared/domain/models.js";

/**
 * **Todo List**:
 *   - Use the services we've defined to write the main program's business
 *     logic in the `main` Effect below
 *
 * **Business Logic**
 *   - For each misbehavior:
 *     - Use the `PunDistributionNetwork` to get a pun delivery channel
 *       for the pun
 *     - Use the `PunsterClient` to create a pun
 *     - Use the `PunDistributionNetwork` to deliver the pun to the delivery
 *       channel
 *     - Log out the result of delivering the pun
 *
 * **Hint**: You'll probably need to access the above services somehow!
 *
 * **Bonus Objectives**:
 *
 *   **Error Handling**:
 *     - Log a warning message if a child had an immunity token
 *     - Log an error message if a pun failed to be fetched from PUNSTER
 *
 *   **Other**:
 *     - Use the `ImmunityTokenManager` to give other children immunity
 *       - check `./fixtures/Misbehaviors.ts` to see the available children
 */

const deliverPun = (mis: Misbehavior) => (chn: Channel) =>
  Effect.Do.pipe(
    Effect.bind("client", () => PunsterClient),
    Effect.bind("network", () => PunDistributionNetwork),
    Effect.bind("pun", ({ client }) => client.createPun(mis)),
    Effect.andThen(({ pun, network }) => network.deliverPun(pun, mis, chn)),
  );

//                 ┏━━━━━━━━━━━━━━━━━━━━ string
//                 ┃         ┏━━━━━━━━━━ ChildImmuneError | MalformedPunError | PunsterFetchError | NoChannelAvailableError
//                 ┃         ┃       ┏━━ PunsterClient | PunDistributionNetwork
//     ┏━ Effect<Success, Error, Require>
const misbehaviorToPun = (mis: Misbehavior) =>
  PunDistributionNetwork.pipe(
    Effect.andThen((service) => service.getChannel(mis)),
    Effect.andThen(deliverPun(mis)),
    Effect.tap(Console.log),
  );

export const main = pipe(
  misbehaviors,
  Array.map(misbehaviorToPun),
  Effect.all,
  Effect.catchTags({
    ChildImmuneError: () => Console.warn("Child had an immunity token"),
    PunsterFetchError: () =>
      Console.error("Pun failed to be fetched from PUNSTER"),
  }),
);

//                                   ┏━ Will error cause PunsterClient | PunDistributionNetwork are not provided
// const runner = Effect.runPromise(main)
