package com.demo.burn.l1

import java.util.UUID

import io.constellationnetwork.BuildInfo
import io.constellationnetwork.currency.l1.CurrencyL1App
import io.constellationnetwork.schema.cluster.ClusterId
import io.constellationnetwork.schema.semver.{MetagraphVersion, TessellationVersion}

object Main
    extends CurrencyL1App(
      "burn-demo-l1",
      "burn demo currency L1 node",
      ClusterId(UUID.fromString("517c3a05-9219-471b-a54c-21b7d72f4ae5")),
      metagraphVersion = MetagraphVersion.unsafeFrom(BuildInfo.version),
      tessellationVersion = TessellationVersion.unsafeFrom(BuildInfo.version)
    ) {}
