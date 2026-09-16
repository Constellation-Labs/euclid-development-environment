/**
 * Default .gitignore content for Hydra projects.
 * Shared between `install` and `install-template` commands.
 */
export const GITIGNORE_CONTENT = `# IDE and editor files
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
dist/

# Jars (downloaded during build)
docker/artifacts/jars/*.jar

# Genesis files (generated)
data/metagraph-l0/genesis/genesis.address
data/metagraph-l0/genesis/genesis.snapshot

# Local dev-cluster genesis (throwaway, regenerated on every start --genesis)
docker/artifacts/genesis-local/*
!docker/artifacts/genesis-local/.gitkeep

# NOTE: docker/artifacts/genesis/ (the remote genesis) is deliberately NOT
# ignored — it defines your metagraph ID and cannot be regenerated. Commit it.

# Grafana data
docker/grafana/grafana/config/
docker/grafana/prometheus/data/
docker/grafana/prometheus/monitoring/

# Monitoring service
data/*-monitoring-service/node_modules
data/*-monitoring-service/config/config.json
data/*-monitoring-service/config/id_monitoring

# Project config (contains p12 passwords)
euclid.json

# Private key files
data/p12-files/*
!data/p12-files/.gitkeep
`;
