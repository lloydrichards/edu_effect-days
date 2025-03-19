import { Context, Effect } from "effect";

// The "./shared/domain/*.js" imports provide domain-specific types and errors
// used across the Pun-ishment Protocol application. They are imported from a
// shared module to save time and avoid redefining them
import type {
  ChildImmuneError,
  MalformedPunError,
  NoChannelAvailableError,
  NoTokenAvailableError,
  PunsterFetchError,
} from "./shared/domain/errors.js";
import type { Channel, Misbehavior, Pun } from "./shared/domain/models";

/**
 * **Todo List**:
 *   - Create a unique type-level and runtime identifier for each of the
 *     services specified below.
 *
 * **Hint**: You may need to import the `Context` module from Effect!
 */

// NOTE: Shape is a common name for the interface that describes the service
//       methods. You can use any name you like, but it's a good practice to
//       follow a consistent naming convention for your service interfaces.

/**
 * The Punster Client is responsible for interacting with PUNSTER to create puns
 * and perform evaluations on pun delivery.
 */
class PunClient extends Context.Tag("app/PunClient")<
  PunClient,
  {
    readonly createPun: (
      misbehavior: Misbehavior
    ) => Effect.Effect<
      Pun,
      ChildImmuneError | MalformedPunError | PunsterFetchError
    >;
    readonly evaluatePun: (
      pun: Pun,
      misbehavior: Misbehavior,
      channel: Channel
    ) => Effect.Effect<string, PunsterFetchError>;
  }
>() {}

/**
 * The Pun Distribution Network (PDN) is responsible for controlling access to
 * the most optimal communication channels for delivering puns.
 */
class PunDistributionNetwork extends Context.Tag("app/PunDistributionNetwork")<
  PunDistributionNetwork,
  {
    readonly getChannel: (
      misbehavior: Misbehavior
    ) => Effect.Effect<Channel, NoChannelAvailableError>;
    readonly deliverPun: (
      pun: Pun,
      misbehavior: Misbehavior,
      channel: Channel
    ) => Effect.Effect<string>;
  }
>() {}

/**
 * The Immunity Token Manager is a service that allows children to earn pun
 * immunity tokens, providing positive reinforcement for good behavior. All
 * tokens are reset each day at `00:00`.
 */
class ImmunityTokenManager extends Context.Tag("app/ImmunityTokenManager")<
  ImmunityTokenManager,
  {
    readonly getBalance: (childName: string) => Effect.Effect<number>;
    readonly awardToken: (
      childName: string,
      options: { readonly reason: string }
    ) => Effect.Effect<void>;
    readonly useToken: (
      childName: string
    ) => Effect.Effect<number, NoTokenAvailableError>;
  }
>() {}
