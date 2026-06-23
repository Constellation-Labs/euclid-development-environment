package com.demo.burn.shared_data.combiners

import scala.collection.immutable.SortedSet

import cats.data.NonEmptyList
import cats.effect.Async
import cats.syntax.all._

import io.constellationnetwork.currency.dataApplication.{DataState, L0NodeContext}
import io.constellationnetwork.schema.artifact.{BurnAction, BurnTransaction, SharedArtifact}
import io.constellationnetwork.schema.swap.{CurrencyId, SwapAmount}
import io.constellationnetwork.security.signature.Signed

import com.demo.burn.shared_data.types.Types.{BurnCalculatedState, BurnRequest, BurnState}
import eu.timepit.refined.types.numeric.PosLong
import org.typelevel.log4cats.SelfAwareStructuredLogger
import org.typelevel.log4cats.slf4j.Slf4jLogger

object Combiners {
  private def logger[F[_]: Async]: SelfAwareStructuredLogger[F] =
    Slf4jLogger.getLoggerFromName[F]("BurnCombiners")

  /** For each accepted BurnRequest, emit a native no-ref self-burn BurnAction into the
    * snapshot's sharedArtifacts. source == the metagraph's own currency address
    * (read from the node context), currencyId == None (the metagraph's own token),
    * allowSpendRef == None (no AllowSpend; pure self-burn against the address balance).
    *
    * The L0 acceptance pipeline validates each BurnAction against the address balance and,
    * if accepted, debits the balance and reduces totalSupply by the burned amount.
    */
  def combineBurnRequests[F[_]: Async](
    oldState: DataState[BurnState, BurnCalculatedState],
    updates: List[Signed[BurnRequest]]
  )(implicit context: L0NodeContext[F]): F[DataState[BurnState, BurnCalculatedState]] =
    if (updates.isEmpty) {
      // No data updates this window — clear pending on-chain state, keep calculated totals.
      logger.info("No burn requests in this snapshot window").as(
        DataState(BurnState.empty, oldState.calculated, oldState.sharedArtifacts)
      )
    } else {
      context.getCurrencyId.flatMap { currencyId =>
        val sourceAddress = currencyId.value

        val burnTransactions: List[BurnTransaction] = updates.map { signed =>
          BurnTransaction(
            allowSpendRef = None,
            // currencyId must be Some(metagraph address): the L0 acceptance manager keys the
            // burn-validation balance map under Some(metagraphId), so a None currencyId would
            // look up an empty balance map and the self-burn would be silently rejected.
            currencyId = Some(CurrencyId(sourceAddress)),
            amount = SwapAmount(PosLong.unsafeFrom(signed.value.amount)),
            source = sourceAddress
          )
        }

        val burnArtifacts: SortedSet[SharedArtifact] =
          NonEmptyList.fromList(burnTransactions) match {
            case Some(nel) => SortedSet[SharedArtifact](BurnAction(nel))
            case None      => SortedSet.empty[SharedArtifact]
          }

        val totalThisWindow = burnTransactions.map(_.amount.value.value).sum
        val amounts = updates.map(_.value.amount)

        val newCalculated = BurnCalculatedState(
          totalBurnRequests = oldState.calculated.totalBurnRequests + updates.size.toLong,
          totalBurnedAmount = oldState.calculated.totalBurnedAmount + totalThisWindow
        )

        logger
          .info(
            s"Emitting BurnAction: ${burnTransactions.size} self-burn(s) from $sourceAddress, total=$totalThisWindow"
          )
          .as(
            DataState(
              BurnState(amounts),
              newCalculated,
              oldState.sharedArtifacts ++ burnArtifacts
            )
          )
      }
    }
}
