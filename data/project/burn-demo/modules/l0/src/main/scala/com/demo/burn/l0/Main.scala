package com.demo.burn.l0

import java.util.UUID

import cats.data.NonEmptyList
import cats.effect.{IO, Resource}
import cats.syntax.all._

import io.constellationnetwork.BuildInfo
import io.constellationnetwork.currency.dataApplication._
import io.constellationnetwork.currency.dataApplication.dataApplication.{DataApplicationBlock, DataApplicationValidationErrorOr}
import io.constellationnetwork.currency.l0.CurrencyL0App
import io.constellationnetwork.currency.schema.currency.{CurrencyIncrementalSnapshot, CurrencySnapshotStateProof}
import io.constellationnetwork.ext.cats.effect.ResourceIO
import io.constellationnetwork.node.shared.domain.rewards.Rewards
import io.constellationnetwork.node.shared.snapshot.currency.CurrencySnapshotEvent
import io.constellationnetwork.schema.SnapshotOrdinal
import io.constellationnetwork.schema.cluster.ClusterId
import io.constellationnetwork.schema.semver.{MetagraphVersion, TessellationVersion}
import io.constellationnetwork.security.SecurityProvider
import io.constellationnetwork.security.hash.Hash
import io.constellationnetwork.security.signature.Signed

import com.demo.burn.l0.custom_routes.CustomRoutes
import com.demo.burn.shared_data.LifecycleSharedFunctions
import com.demo.burn.shared_data.calculated_state.CalculatedStateService
import com.demo.burn.shared_data.deserializers.Deserializers
import com.demo.burn.shared_data.serializers.Serializers
import com.demo.burn.shared_data.types.Types._
import io.circe.{Decoder, Encoder}
import org.http4s.circe.CirceEntityCodec.circeEntityDecoder
import org.http4s.{EntityDecoder, HttpRoutes}

object Main
    extends CurrencyL0App(
      "burn-demo-l0",
      "burn demo currency L0 node",
      ClusterId(UUID.fromString("517c3a05-9219-471b-a54c-21b7d72f4ae5")),
      metagraphVersion = MetagraphVersion.unsafeFrom(BuildInfo.version),
      tessellationVersion = TessellationVersion.unsafeFrom(BuildInfo.version)
    ) {

  private def makeBaseDataApplicationL0Service(
    calculatedStateService: CalculatedStateService[IO]
  ): BaseDataApplicationL0Service[IO] =
    BaseDataApplicationL0Service(
      new DataApplicationL0Service[IO, BurnRequest, BurnState, BurnCalculatedState] {
        override def genesis: DataState[BurnState, BurnCalculatedState] =
          DataState(BurnState.empty, BurnCalculatedState.empty)

        override def validateData(
          state: DataState[BurnState, BurnCalculatedState],
          updates: NonEmptyList[Signed[BurnRequest]]
        )(implicit context: L0NodeContext[IO]): IO[DataApplicationValidationErrorOr[Unit]] =
          LifecycleSharedFunctions.validateData[IO](state, updates)

        override def combine(
          state: DataState[BurnState, BurnCalculatedState],
          updates: List[Signed[BurnRequest]]
        )(implicit context: L0NodeContext[IO]): IO[DataState[BurnState, BurnCalculatedState]] =
          LifecycleSharedFunctions.combine[IO](state, updates)

        override def dataEncoder: Encoder[BurnRequest] = implicitly[Encoder[BurnRequest]]

        override def dataDecoder: Decoder[BurnRequest] = implicitly[Decoder[BurnRequest]]

        override def calculatedStateEncoder: Encoder[BurnCalculatedState] = implicitly[Encoder[BurnCalculatedState]]

        override def calculatedStateDecoder: Decoder[BurnCalculatedState] = implicitly[Decoder[BurnCalculatedState]]

        override def signedDataEntityDecoder: EntityDecoder[IO, Signed[BurnRequest]] = circeEntityDecoder

        override def serializeBlock(block: Signed[DataApplicationBlock]): IO[Array[Byte]] =
          IO(Serializers.serializeBlock(block)(dataEncoder.asInstanceOf[Encoder[DataUpdate]]))

        override def deserializeBlock(bytes: Array[Byte]): IO[Either[Throwable, Signed[DataApplicationBlock]]] =
          IO(Deserializers.deserializeBlock(bytes)(dataDecoder.asInstanceOf[Decoder[DataUpdate]]))

        override def serializeState(state: BurnState): IO[Array[Byte]] =
          IO(Serializers.serializeState(state))

        override def deserializeState(bytes: Array[Byte]): IO[Either[Throwable, BurnState]] =
          IO(Deserializers.deserializeState(bytes))

        override def serializeUpdate(update: BurnRequest): IO[Array[Byte]] =
          IO(Serializers.serializeUpdate(update))

        override def deserializeUpdate(bytes: Array[Byte]): IO[Either[Throwable, BurnRequest]] =
          IO(Deserializers.deserializeUpdate(bytes))

        override def getCalculatedState(implicit context: L0NodeContext[IO]): IO[(SnapshotOrdinal, BurnCalculatedState)] =
          calculatedStateService.getCalculatedState.map(cs => (cs.ordinal, cs.state))

        override def setCalculatedState(
          ordinal: SnapshotOrdinal,
          state: BurnCalculatedState
        )(implicit context: L0NodeContext[IO]): IO[Boolean] =
          calculatedStateService.setCalculatedState(ordinal, state)

        override def hashCalculatedState(
          state: BurnCalculatedState
        )(implicit context: L0NodeContext[IO]): IO[Hash] =
          calculatedStateService.hashCalculatedState(state)

        override def routes(implicit context: L0NodeContext[IO]): HttpRoutes[IO] =
          CustomRoutes[IO](calculatedStateService).public

        override def serializeCalculatedState(state: BurnCalculatedState): IO[Array[Byte]] =
          IO(Serializers.serializeCalculatedState(state))

        override def deserializeCalculatedState(bytes: Array[Byte]): IO[Either[Throwable, BurnCalculatedState]] =
          IO(Deserializers.deserializeCalculatedState(bytes))
      }
    )

  private def makeL0Service: IO[BaseDataApplicationL0Service[IO]] =
    for {
      calculatedStateService <- CalculatedStateService.make[IO]
      dataApplicationL0Service = makeBaseDataApplicationL0Service(calculatedStateService)
    } yield dataApplicationL0Service

  override def dataApplication: Option[Resource[IO, BaseDataApplicationL0Service[IO]]] =
    makeL0Service.asResource.some

  override def rewards(
    implicit sp: SecurityProvider[IO]
  ): Option[Rewards[IO, CurrencySnapshotStateProof, CurrencyIncrementalSnapshot, CurrencySnapshotEvent]] =
    None
}
