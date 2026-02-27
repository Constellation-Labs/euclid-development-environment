#!/usr/bin/env bash

function install_project() {
  echo_title "################################## INSTALL ##################################"
  echo_white "Installing hydra ..."
  echo_white "Installing Framework..."
  create_template project

  cd $ROOT_PATH
  if [ -d ".git" ]; then
    chmod -R +w .git
    rm -r .git
  fi

  cat > .gitignore << 'GITIGNORE'
# IDE and editor files
.idea/
.vscode/
*.swp
*.swo
*~

# OS files
.DS_Store

# Scala build artifacts
.metals/
.bloop/
.bsp/
.scala-build/
target/
metals.sbt
**/metals.sbt
project/metals.sbt
project/project/metals.sbt
.scalafmt-cache
.scalafix-cache

# Node
node_modules/

# Jars (downloaded during build)
infra/shared/jars/*.jar

# Genesis files (generated)
source/metagraph-l0/genesis/genesis.address
source/metagraph-l0/genesis/genesis.snapshot
infra/shared/genesis/*

# Grafana data
infra/grafana/grafana/config/
infra/grafana/prometheus/data/
infra/grafana/prometheus/monitoring/

# Monitoring service
source/*-monitoring-service/node_modules
source/*-monitoring-service/config/config.json
source/*-monitoring-service/config/id_monitoring

# Shared data (generated at runtime)
infra/shared/data/*
!infra/shared/data/.gitkeep

# Project config (contains p12 passwords)
euclid.json

# Private key files
source/p12-files/*
!source/p12-files/.gitkeep
GITIGNORE

  git init
  git add -A
  git commit -m "Initial commit after hydra install"

  echo_green "Installed"
  
}