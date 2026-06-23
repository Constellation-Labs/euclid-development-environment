import Dependencies.*
import sbt.*

ThisBuild / organization := "com.demo.burn"
ThisBuild / scalaVersion := "2.13.18"
ThisBuild / evictionErrorLevel := Level.Warn

ThisBuild / assemblyMergeStrategy := {
  case "logback.xml" => MergeStrategy.first
  case x if x.contains("io.netty.versions.properties") => MergeStrategy.discard
  case x if x.contains("scala.semanticdb") => MergeStrategy.discard
  case PathList("META-INF", "versions", _, "OSGI-INF", _ @_*) => MergeStrategy.discard
  case PathList("META-INF", "versions", _, "OSGI-INF", _, _ @_*) => MergeStrategy.discard
  case PathList(xs@_*) if xs.last == "MANIFEST.MF" => MergeStrategy.discard
  case PathList(xs@_*) if xs.last == "module-info.class" => MergeStrategy.first
  case x =>
    val oldStrategy = (assembly / assemblyMergeStrategy).value
    oldStrategy(x)
}

lazy val root = (project in file(".")).
  settings(
    name := "burn_demo"
  ).aggregate(sharedData, currencyL0, currencyL1, dataL1)

lazy val sharedData = (project in file("modules/shared_data"))
  .enablePlugins(AshScriptPlugin)
  .enablePlugins(BuildInfoPlugin)
  .enablePlugins(JavaAppPackaging)
  .settings(
    name := "burn_demo-shared_data",
    scalacOptions ++= List("-Ymacro-annotations", "-Yrangepos", "-Wconf:cat=unused:info", "-language:reflectiveCalls"),
    buildInfoKeys := Seq[BuildInfoKey](name, version, scalaVersion, sbtVersion),
    buildInfoPackage := "com.demo.burn.shared_data",
    resolvers += Resolver.mavenLocal,
    Defaults.itSettings,
    libraryDependencies ++= Seq(
      Libraries.tessellationSdk,
      Libraries.requests
    )
  )

lazy val currencyL1 = (project in file("modules/l1"))
  .enablePlugins(AshScriptPlugin)
  .enablePlugins(BuildInfoPlugin)
  .enablePlugins(JavaAppPackaging)
  .settings(
    name := "burn_demo-currency-l1",
    scalacOptions ++= List("-Ymacro-annotations", "-Yrangepos", "-Wconf:cat=unused:info", "-language:reflectiveCalls"),
    buildInfoKeys := Seq[BuildInfoKey](name, version, scalaVersion, sbtVersion),
    buildInfoPackage := "com.demo.burn.l1",
    resolvers += Resolver.mavenLocal,
    Defaults.itSettings,
    libraryDependencies ++= Seq(
      Libraries.tessellationSdk
    )
  )

lazy val currencyL0 = (project in file("modules/l0"))
  .enablePlugins(AshScriptPlugin)
  .enablePlugins(BuildInfoPlugin)
  .enablePlugins(JavaAppPackaging)
  .dependsOn(sharedData)
  .settings(
    name := "burn_demo-currency-l0",
    scalacOptions ++= List("-Ymacro-annotations", "-Yrangepos", "-Wconf:cat=unused:info", "-language:reflectiveCalls"),
    buildInfoKeys := Seq[BuildInfoKey](name, version, scalaVersion, sbtVersion),
    buildInfoPackage := "com.demo.burn.l0",
    resolvers += Resolver.mavenLocal,
    Defaults.itSettings,
    libraryDependencies ++= Seq(
      Libraries.declineRefined,
      Libraries.declineCore,
      Libraries.declineEffect,
      Libraries.tessellationSdk
    )
  )

lazy val dataL1 = (project in file("modules/data_l1"))
  .enablePlugins(AshScriptPlugin)
  .enablePlugins(BuildInfoPlugin)
  .enablePlugins(JavaAppPackaging)
  .dependsOn(sharedData)
  .settings(
    name := "burn_demo-data_l1",
    scalacOptions ++= List("-Ymacro-annotations", "-Yrangepos", "-Wconf:cat=unused:info", "-language:reflectiveCalls"),
    buildInfoKeys := Seq[BuildInfoKey](name, version, scalaVersion, sbtVersion),
    buildInfoPackage := "com.demo.burn.data_l1",
    resolvers += Resolver.mavenLocal,
    Defaults.itSettings,
    libraryDependencies ++= Seq(
      Libraries.tessellationSdk
    )
  )
