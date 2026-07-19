package com.demo.burn.shared_data

import cats.data.NonEmptyList
import cats.effect.Async
import cats.syntax.all._

import io.constellationnetwork.currency.dataApplication.dataApplication.DataApplicationValidationErrorOr
import io.constellationnetwork.currency.dataApplication.{DataState, L0NodeContext}
import io.constellationnetwork.security.signature.Signed

import com.demo.burn.shared_data.combiners.Combiners.combineBurnRequests
import com.demo.burn.shared_data.types.Types.{BurnCalculatedState, BurnRequest, BurnState}
import com.demo.burn.shared_data.validations.Validations.validateBurnRequest

object LifecycleSharedFunctions {

  def validateUpdate[F[_]: Async](
    update: BurnRequest
  ): F[DataApplicationValidationErrorOr[Unit]] =
    Async[F].delay(validateBurnRequest(update))

  def validateData[F[_]: Async](
    oldState: DataState[BurnState, BurnCalculatedState],
    updates: NonEmptyList[Signed[BurnRequest]]
  ): F[DataApplicationValidationErrorOr[Unit]] =
    updates
      .traverse(signed => Async[F].delay(validateBurnRequest(signed.value)))
      .map(_.reduce)

  def combine[F[_]: Async](
    oldState: DataState[BurnState, BurnCalculatedState],
    updates: List[Signed[BurnRequest]]
  )(implicit context: L0NodeContext[F]): F[DataState[BurnState, BurnCalculatedState]] =
    combineBurnRequests(oldState, updates)
}
