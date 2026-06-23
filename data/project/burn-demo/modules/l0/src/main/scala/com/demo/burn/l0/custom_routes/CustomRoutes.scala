package com.demo.burn.l0.custom_routes

import cats.effect.Async
import cats.syntax.all._

import io.constellationnetwork.routes.internal.{InternalUrlPrefix, PublicRoutes}

import com.demo.burn.shared_data.calculated_state.CalculatedStateService
import eu.timepit.refined.auto._
import org.http4s._
import org.http4s.circe.CirceEntityCodec.circeEntityEncoder
import org.http4s.dsl.Http4sDsl
import org.http4s.server.middleware.CORS

case class CustomRoutes[F[_]: Async](
  calculatedStateService: CalculatedStateService[F]
) extends Http4sDsl[F]
    with PublicRoutes[F] {

  private def getCalculatedState: F[Response[F]] =
    calculatedStateService.getCalculatedState.flatMap(cs => Ok(cs.state))

  private val routes: HttpRoutes[F] = HttpRoutes.of[F] {
    case GET -> Root / "calculated-state" => getCalculatedState
  }

  val public: HttpRoutes[F] =
    CORS.policy
      .withAllowCredentials(false)
      .httpRoutes(routes)

  override protected def prefixPath: InternalUrlPrefix = "/"
}
