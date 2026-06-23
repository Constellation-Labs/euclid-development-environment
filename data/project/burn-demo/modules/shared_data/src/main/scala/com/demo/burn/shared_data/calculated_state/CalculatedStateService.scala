package com.demo.burn.shared_data.calculated_state

import java.nio.charset.StandardCharsets

import cats.effect.Ref
import cats.effect.kernel.Async
import cats.syntax.all._

import io.constellationnetwork.schema.SnapshotOrdinal
import io.constellationnetwork.security.hash.Hash

import com.demo.burn.shared_data.types.Types.BurnCalculatedState
import io.circe.syntax.EncoderOps

trait CalculatedStateService[F[_]] {
  def getCalculatedState: F[CalculatedState]

  def setCalculatedState(
    snapshotOrdinal: SnapshotOrdinal,
    state: BurnCalculatedState
  ): F[Boolean]

  def hashCalculatedState(
    state: BurnCalculatedState
  ): F[Hash]
}

object CalculatedStateService {
  def make[F[_]: Async]: F[CalculatedStateService[F]] =
    Ref.of[F, CalculatedState](CalculatedState.empty).map { stateRef =>
      new CalculatedStateService[F] {
        override def getCalculatedState: F[CalculatedState] = stateRef.get

        override def setCalculatedState(
          snapshotOrdinal: SnapshotOrdinal,
          state: BurnCalculatedState
        ): F[Boolean] =
          stateRef.modify { _ =>
            CalculatedState(snapshotOrdinal, state) -> true
          }

        override def hashCalculatedState(
          state: BurnCalculatedState
        ): F[Hash] = Async[F].delay {
          Hash.fromBytes(
            state.asJson.deepDropNullValues.noSpaces.getBytes(StandardCharsets.UTF_8)
          )
        }
      }
    }
}
