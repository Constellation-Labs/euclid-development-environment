package com.demo.burn.shared_data.errors

import cats.syntax.all._

import io.constellationnetwork.currency.dataApplication.DataApplicationValidationError
import io.constellationnetwork.currency.dataApplication.dataApplication.DataApplicationValidationErrorOr

object Errors {
  type DataApplicationValidationType = DataApplicationValidationErrorOr[Unit]

  val valid: DataApplicationValidationType =
    ().validNec[DataApplicationValidationError]

  implicit class DataApplicationValidationTypeOps[E <: DataApplicationValidationError](err: E) {
    def invalid: DataApplicationValidationType =
      err.invalidNec[Unit]

    def unless(cond: Boolean): DataApplicationValidationType =
      if (cond) valid else invalid

    def when(cond: Boolean): DataApplicationValidationType =
      if (cond) invalid else valid
  }

  case object AmountNotPositive extends DataApplicationValidationError {
    val message = "Burn amount must be positive"
  }
}
