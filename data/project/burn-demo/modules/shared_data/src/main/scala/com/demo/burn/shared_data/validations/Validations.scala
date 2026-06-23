package com.demo.burn.shared_data.validations

import io.constellationnetwork.currency.dataApplication.dataApplication.DataApplicationValidationErrorOr

import com.demo.burn.shared_data.errors.Errors._
import com.demo.burn.shared_data.types.Types.BurnRequest

object Validations {
  def validateBurnRequest(
    update: BurnRequest
  ): DataApplicationValidationErrorOr[Unit] =
    AmountNotPositive.unless(update.amount > 0L)
}
