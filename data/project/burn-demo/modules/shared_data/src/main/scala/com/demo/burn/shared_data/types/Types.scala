package com.demo.burn.shared_data.types

import derevo.circe.magnolia.{decoder, encoder}
import derevo.derive
import io.constellationnetwork.currency.dataApplication.{DataCalculatedState, DataOnChainState, DataUpdate}

object Types {

  /** A request to burn `amount` of the metagraph's own currency (no-ref self-burn).
    * The combine reads the metagraph's own currency address from the node context and
    * emits a native BurnAction whose source == that address.
    */
  @derive(decoder, encoder)
  case class BurnRequest(
    amount: Long
  ) extends DataUpdate

  /** On-chain state: the list of burn amounts accepted in the current snapshot window. */
  @derive(decoder, encoder)
  case class BurnState(
    pendingBurns: List[Long]
  ) extends DataOnChainState

  object BurnState {
    def empty: BurnState = BurnState(List.empty)
  }

  /** Calculated state: running totals across the metagraph's lifetime. */
  @derive(decoder, encoder)
  case class BurnCalculatedState(
    totalBurnRequests: Long,
    totalBurnedAmount: Long
  ) extends DataCalculatedState

  object BurnCalculatedState {
    def empty: BurnCalculatedState = BurnCalculatedState(0L, 0L)
  }
}
