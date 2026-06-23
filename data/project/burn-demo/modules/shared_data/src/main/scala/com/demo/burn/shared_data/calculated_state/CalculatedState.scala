package com.demo.burn.shared_data.calculated_state

import com.demo.burn.shared_data.types.Types.BurnCalculatedState
import io.constellationnetwork.schema.SnapshotOrdinal

case class CalculatedState(ordinal: SnapshotOrdinal, state: BurnCalculatedState)

object CalculatedState {
  def empty: CalculatedState =
    CalculatedState(SnapshotOrdinal.MinValue, BurnCalculatedState.empty)
}
