package com.demo.burn.data_l1

import java.util.UUID

import cats.effect.{IO, Resource}
import cats.syntax.all._

import io.constellationnetwork.BuildInfo
import io.constellationnetwork.currency.dataApplication._
import io.constellationnetwork.currency.dataApplication.dataApplication.{DataApplicationBlock, DataApplicationValidationErrorOr}
import io.constellationnetwork.currency.l1.CurrencyL1App
import io.constellationnetwork.ext.cats.effect.ResourceIO
import io.constellationnetwork.schema.cluster.ClusterId
import io.constellationnetwork.schema.semver.{MetagraphVersion, TessellationVersion}
import io.constellationnetwork.security.signature.Signed

import com.demo.burn.shared_data.LifecycleSharedFunctions
import com.demo.burn.shared_data.deserializers.Deserializers
import com.demo.burn.shared_data.serializers.Serializers
import com.demo.burn.shared_data.types.Types._
import io.circe.{Decoder, Encoder}
import org.http4s.circe.CirceEntityCodec.circeEntityDecoder
import org.http4s.{EntityDecoder, HttpRoutes}

object Main
    extends CurrencyL1App(
      "burn-demo-data_l1",
      "burn demo currency data L1 node",
      ClusterId(UUID.fromString("517c3a05-9219-471b-a54c-21b7d72f4ae5")),
      metagraphVersion = MetagraphVersion.unsafeFrom(BuildInfo.version),
      tessellationVersion = TessellationVersion.unsafeFrom(BuildInfo.version)
    ) {

  private def makeBaseDataApplicationL1Service: BaseDataApplicationL1Service[IO] =
    BaseDataApplicationL1Service(
      new DataApplicationL1Service[IO, BurnRequest, BurnState, BurnCalculatedState] {
        override def validateUpdate(
          update: BurnRequest
        )(implicit context: L1NodeContext[IO]): IO[DataApplicationValidationErrorOr[Unit]] =
          LifecycleSharedFunctions.validateUpdate[IO](update)

        override def routes(implicit context: L1NodeContext[IO]): HttpRoutes[IO] =
          HttpRoutes.empty

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

        override def serializeCalculatedState(state: BurnCalculatedState): IO[Array[Byte]] =
          IO(Serializers.serializeCalculatedState(state))

        override def deserializeCalculatedState(bytes: Array[Byte]): IO[Either[Throwable, BurnCalculatedState]] =
          IO(Deserializers.deserializeCalculatedState(bytes))
      }
    )

  private def makeL1Service: IO[BaseDataApplicationL1Service[IO]] =
    makeBaseDataApplicationL1Service.pure[IO]

  override def dataApplication: Option[Resource[IO, BaseDataApplicationL1Service[IO]]] =
    makeL1Service.asResource.some
}
