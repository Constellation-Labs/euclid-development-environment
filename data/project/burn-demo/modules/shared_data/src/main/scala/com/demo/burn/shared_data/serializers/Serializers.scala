package com.demo.burn.shared_data.serializers

import java.nio.charset.StandardCharsets

import io.constellationnetwork.currency.dataApplication.DataUpdate
import io.constellationnetwork.currency.dataApplication.dataApplication.DataApplicationBlock
import io.constellationnetwork.security.signature.Signed

import com.demo.burn.shared_data.types.Types.{BurnCalculatedState, BurnRequest, BurnState}
import io.circe.Encoder
import io.circe.syntax.EncoderOps

object Serializers {
  private def serialize[A: Encoder](
    serializableData: A
  ): Array[Byte] =
    serializableData.asJson.deepDropNullValues.noSpaces.getBytes(StandardCharsets.UTF_8)

  def serializeUpdate(update: BurnRequest): Array[Byte] =
    serialize[BurnRequest](update)

  def serializeState(state: BurnState): Array[Byte] =
    serialize[BurnState](state)

  def serializeBlock(
    state: Signed[DataApplicationBlock]
  )(implicit e: Encoder[DataUpdate]): Array[Byte] =
    serialize[Signed[DataApplicationBlock]](state)

  def serializeCalculatedState(state: BurnCalculatedState): Array[Byte] =
    serialize[BurnCalculatedState](state)
}
