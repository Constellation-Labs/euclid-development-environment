# Euclid Development Environment

Build, run, and deploy [Constellation Network](https://constellationnetwork.io/) metagraphs locally and remotely.

Euclid provides the **Hydra CLI** (`hydra` / `euclid`) for orchestrating multi-layer metagraph clusters using Docker, with remote deployment via native SSH.

## Prerequisites

| Dependency | Version | Purpose |
|---|---|---|
| **Node.js** | >= 22.0.0 | Runs the CLI |
| **Docker** | >= 26.0.0 | Container orchestration for local clusters |
| **git** | any | Template cloning and project scaffolding |

Optional (for remote operations and seedlist checks):
- **ssh** — remote deployment via `node-ssh`
- **Java 21** — seedlist verification via `cl-wallet.jar`

> **Hydra v1 vs v2**: Previous versions required Ansible, Rust/Cargo (for argc), jq, yq, and Scala/Coursier (for g8). Hydra v2 eliminates all of these — everything runs through Node.js and Docker.

---

## Quick Start

```bash
# Install dependencies and build
npm install

# Make hydra/euclid available globally (optional)
npm link

# Verify your environment
hydra doctor

# Install a metagraph template
hydra install-template --name my-metagraph --repo https://github.com/Constellation-Labs/metagraph-examples.git

# Initialize git and .gitignore
hydra install

# Build Docker images (compiles Tessellation + metagraph JARs)
hydra build

# Start the local cluster from genesis
hydra start --genesis

# Check cluster status
hydra status

# View logs for a specific layer
hydra logs metagraph-l0

# Stop the cluster
hydra stop

# Destroy containers and network
hydra destroy --yes
```

> You can also use `npx hydra`, `npx euclid`, or `euclid` instead of `hydra`.

---

## Commands

### Environment

```
hydra doctor                          Verify Docker, ports, config, and dependencies
```

### Configuration

```
hydra config show                     Display the current configuration
hydra config validate                 Validate euclid.json and report any issues
hydra config migrate                  Migrate a legacy v1 config to v2 format
```

### Project Setup

```
hydra install                         Create .gitignore and initialize git repository
hydra install-template [options]      Install a project from a Git repository template
hydra install-monitoring-service      Download and configure metagraph-monitoring-service
```

**`install-template` options:**

| Flag | Description |
|---|---|
| `--name <name>` | Template name to install (required unless `--list`) |
| `--repo <url>` | Git repository URL (default: `metagraph-examples`) |
| `--path <path>` | Path within the repository (default: `examples`) |
| `--branch <branch>` | Branch to checkout |
| `--list` | List available templates and exit |

Example:

```bash
# List available templates
hydra install-template --list

# Install a specific template
hydra install-template --name my-metagraph

# Install from a custom repo on a specific branch
hydra install-template --name my-project --repo https://github.com/my-org/templates.git --branch develop
```

### Local Cluster

```
hydra build [--no-cache]              Build Docker images and compile metagraph JARs
hydra start [--genesis]               Start the local cluster (rollback or genesis mode)
hydra stop                            Stop all layers and containers
hydra status                          Show cluster health and node info
hydra logs <layer>                    Tail logs for a layer (e.g. metagraph-l0)
hydra destroy [--yes]                 Remove containers, network, and genesis files
hydra purge [--yes]                   Destroy + remove all Docker images
```

### Remote Deployment

```
hydra remote deploy [--force-genesis] Deploy JARs, keys, and genesis files to remote hosts
hydra remote start [--genesis]        Start the remote metagraph cluster
hydra remote status                   Check remote node health
hydra remote logs <host> <layer>      Tail logs on a remote host
hydra remote deploy-monitoring        Deploy monitoring service to remote host
hydra remote start-monitoring         Start monitoring service (--force-restart to restart)
hydra remote snapshot-fee-config      Fetch snapshot fee config from remote metagraph
```

### Utilities

```
hydra create-remote-genesis           Run local genesis containers to generate genesis files
hydra update <version> [--yes]        Update Hydra to a specific version from GitHub
hydra check-seedlist <network>        Verify node peer IDs on integrationnet/mainnet seedlist
```

### Global Flags

```
-v, --verbose     Show detailed debug output
--json            Output as JSON (where supported)
--quiet           Suppress non-essential output
--version         Show CLI version
--help            Show help for any command
```

---

## Project Structure

```
euclid-development-environment/
├── src/                            # TypeScript source
│   ├── cli/                        # CLI entry point and command handlers
│   │   ├── commands/               # One file per command
│   │   │   └── remote/             # Remote deployment subcommands
│   │   └── ui/                     # Terminal formatting (colors, tables)
│   ├── core/                       # SDK: config, Docker, cluster management
│   │   ├── config/                 # Zod schema, loader, v1→v2 migration, atomic writer
│   │   ├── docker/                 # dockerode client, docker compose wrapper
│   │   └── cluster/                # Layer orchestration, health polling, state
│   ├── doctor/                     # Environment verification checks
│   │   └── checks/                 # Docker, ports, binaries, config checks
│   └── remote/                     # Remote SSH deployment (replaces Ansible)
│       ├── ssh.ts                  # SSH connection pooling and command execution
│       ├── deploy.ts               # File transfer: JARs, p12 keys, genesis files
│       ├── start.ts                # Layer-by-layer remote orchestration
│       ├── status.ts               # Remote /node/info health queries
│       └── logs.ts                 # Remote log streaming via SSH tail
├── docker/                         # Docker images and build artifacts
│   ├── metagraph-ubuntu/           # Base image: Ubuntu + Java + Tessellation
│   ├── metagraph-base-image/       # Project image: compiles metagraph JARs
│   ├── custom/                     # Custom Dockerfile overrides
│   ├── grafana/                    # Prometheus + Grafana monitoring stack
│   └── artifacts/                  # Build outputs
│       ├── jars/                   # Compiled JARs (cl-keytool, cl-wallet, metagraph-l0, etc.)
│       └── genesis/                # Genesis snapshot and address files
├── data/                           # Runtime data
│   ├── p12-files/                  # Node identity keys (.p12)
│   ├── metagraph-l0/genesis/       # Genesis CSV with pre-funded addresses
│   ├── project/                    # Your Scala metagraph project (after install-template)
│   └── metagraph-monitoring-service/ # Monitoring service (after install-monitoring-service)
├── legacy/                         # Legacy v1 Hydra CLI (preserved for reference)
│   ├── scripts/                    # Original bash CLI
│   └── ansible/                    # Ansible playbooks
├── euclid.json                     # Project configuration
├── package.json                    # Single package (v2.0.0)
├── tsconfig.json                   # TypeScript configuration
└── vitest.config.ts                # Test configuration
```

---

## Configuration

Hydra uses `euclid.json` at the project root. The CLI auto-detects it by walking up the directory tree.

### Config Schema (v2)

```jsonc
{
  // ─── Meta ───────────────────────────────────────────────
  "config_version": 2,

  // ─── Project ────────────────────────────────────────────
  "project_name": "my-metagraph",
  "tessellation_version": "4.0.0-rc.0",
  "tessellation_ref_type": "tag",           // "tag" or "branch"
  "framework": {
    "name": "currency",
    "modules": ["data"],                    // optional: ["data"] for Data L1
    "version": "v3.6.0",
    "ref_type": "tag"                       // "tag" or "branch"
  },

  // ─── Topology ───────────────────────────────────────────
  "layers": [
    "global-l0",
    "metagraph-l0",
    "currency-l1",
    "data-l1"
  ],
  "nodes": [
    {
      "name": "node-1",
      "key_file": {
        "name": "token-key.p12",
        "alias": "token-key",
        "password": "password"
      }
    },
    {
      "name": "node-2",
      "key_file": {
        "name": "token-key-1.p12",
        "alias": "token-key-1",
        "password": "password"
      }
    },
    {
      "name": "node-3",
      "key_file": {
        "name": "token-key-2.p12",
        "alias": "token-key-2",
        "password": "password"
      }
    }
  ],

  // ─── Docker ─────────────────────────────────────────────
  "docker": {
    "start_grafana_container": false,
    "network_subnet": "172.50.0.0/24",      // optional
    "base_ip_prefix": "172.50.0.",           // optional
    "ip_offset": 10                          // optional, port offset per node
  },

  // ─── Local Ports (optional, defaults shown) ─────────────
  "ports": {
    "global_l0":    { "public": 9000, "p2p": 9001, "cli": 9002 },
    "dag_l1":       { "public": 9100, "p2p": 9101, "cli": 9102 },
    "metagraph_l0": { "public": 9200, "p2p": 9201, "cli": 9202 },
    "currency_l1":  { "public": 9300, "p2p": 9301, "cli": 9302 },
    "data_l1":      { "public": 9400, "p2p": 9401, "cli": 9402 }
  },

  // ─── Snapshot Fees (optional) ───────────────────────────
  "snapshot_fees": {
    "owner": {
      "key_file": { "name": "owner.p12", "alias": "owner", "password": "pass" }
    },
    "staking": {
      "key_file": { "name": "staking.p12", "alias": "staking", "password": "pass" }
    }
  },

  // ─── Remote Deployment (optional) ──────────────────────
  "deploy": {
    "network": {
      "name": "integrationnet",             // "integrationnet" or "mainnet"
      "gl0_node": {
        "ip": "your-gl0-node-ip",
        "id": "your-gl0-node-peer-id",
        "public_port": 9000
      }
    },
    "jvm": {
      "min_heap": "1g",
      "max_heap": "2g",
      "metaspace_size": "256m",
      "max_metaspace_size": "512m",
      "additional_opts": ""                 // optional extra JVM flags
    },
    "hosts": [
      { "host": "1.2.3.4", "user": "ubuntu", "ssh_key": "~/.ssh/id_rsa" },
      { "host": "5.6.7.8", "user": "ubuntu", "ssh_key": "~/.ssh/id_rsa" },
      { "host": "9.10.11.12", "user": "ubuntu", "ssh_key": "~/.ssh/id_rsa" }
    ],
    "remote_ports": {                       // optional, defaults shown
      "metagraph_l0": { "public": 9100, "p2p": 9101, "cli": 9102 },
      "currency_l1":  { "public": 9200, "p2p": 9201, "cli": 9202 },
      "data_l1":      { "public": 9300, "p2p": 9301, "cli": 9302 }
    },
    "monitoring_host": {                    // optional, for monitoring service
      "host": "10.0.0.1",
      "user": "ubuntu",
      "ssh_key": "~/.ssh/id_rsa"
    }
  }
}
```

Key points:
- `hosts` maps 1:1 to `nodes` — host-1 runs node-1, host-2 runs node-2, etc.
- `remote_ports` are per-host (not per-container), different from local ports
- `monitoring_host` is used by `remote deploy-monitoring` and `remote start-monitoring`
- All fields inside `docker`, `ports`, `deploy.jvm`, and `deploy.remote_ports` have sensible defaults

---

## Typical Workflows

### Local Development

```bash
# 1. Set up the project
hydra install-template --name my-metagraph
hydra install

# 2. Place your .p12 key files in data/p12-files/

# 3. Build and run
hydra build
hydra start --genesis

# 4. Develop: edit code in data/project/my-metagraph/, rebuild, restart
hydra stop
hydra build
hydra start --genesis

# 5. Clean up
hydra destroy --yes
```

### Remote Deployment (integrationnet/mainnet)

```bash
# 1. Update euclid.json with real deploy config:
#    - Set deploy.network.name to "integrationnet" or "mainnet"
#    - Set deploy.network.gl0_node with a real GL0 node IP, ID, and port
#    - Set deploy.hosts with your 3 remote server IPs, users, and SSH keys

# 2. Check your nodes are on the seedlist (integrationnet/mainnet only)
hydra check-seedlist integrationnet

# 3. Build locally to compile JARs
hydra build

# 4. Generate genesis files for remote deployment
hydra create-remote-genesis

# 5. Deploy artifacts to remote hosts
hydra remote deploy --force-genesis

# 6. Start the remote cluster
hydra remote start --genesis

# 7. Verify everything is running
hydra remote status

# 8. Check logs if needed
hydra remote logs 1.2.3.4 metagraph-l0

# 9. Check fee configuration
hydra remote snapshot-fee-config
```

### Remote Monitoring

```bash
# 1. Generate genesis files first (need metagraph ID)
hydra create-remote-genesis

# 2. Install monitoring service locally
hydra install-monitoring-service

# 3. Edit data/metagraph-monitoring-service/config/config.json
#    - Fill in network node IPs, ports, and IDs
#    - Fill in metagraph node IPs, usernames, and SSH private key paths

# 4. Deploy to remote monitoring host
hydra remote deploy-monitoring

# 5. Start monitoring
hydra remote start-monitoring

# Force restart if already running
hydra remote start-monitoring --force-restart
```

### Updating Hydra

```bash
# Stop any running containers first
hydra stop

# Update to a specific version
hydra update v2.1.0

# Or update with auto-confirm
hydra update v2.1.0 --yes
```

---

## Remote Deployment Details

Hydra v2 replaces Ansible with native SSH deployment via `node-ssh`. No Ansible installation is required.

### How It Works

**`hydra remote deploy`** uploads to each remote host:
- `docker/artifacts/jars/*.jar` — Tessellation and metagraph JARs
- `data/p12-files/*.p12` — Node identity keys (each host gets its own node's key)
- `docker/artifacts/genesis/*` — Genesis snapshot and address files (with `--force-genesis`)
- Snapshot fee P12 files (if `snapshot_fees` is configured)

Remote directory structure on each host:
```
/home/<user>/code/
├── metagraph-l0/     # JARs, keys, genesis files, logs
├── currency-l1/      # JARs, keys, logs (if layer enabled)
└── data-l1/          # JARs, keys, logs (if layer enabled)
```

**`hydra remote start`** follows strict layer ordering:
1. **Metagraph L0**: Start genesis node on host-1, wait for `Ready`, extract peer ID, then start validators on host-2/3, wait for `ReadyToJoin`, join cluster
2. **Currency L1**: Start initial validator on host-1, wait for `Ready`, then validators on host-2/3 join
3. **Data L1**: Same pattern as Currency L1

Each step includes health polling with retries and graceful `Ctrl+C` handling that cleans up SSH connections.

### Remote Ports

Remote ports are different from local ports because each host runs one node (not multiple containers):

| Layer | Public | P2P | CLI |
|---|---|---|---|
| Metagraph L0 | 9100 | 9101 | 9102 |
| Currency L1 | 9200 | 9201 | 9202 |
| Data L1 | 9300 | 9301 | 9302 |

These can be customized via `deploy.remote_ports` in `euclid.json`.

---

## Doctor Command

`hydra doctor` performs comprehensive environment checks:

```
$ hydra doctor

  Hydra Environment Check

  System Dependencies:
  ✓ Docker            27.2.0 (required: >= 26.0.0)
  ✓ Docker Compose    2.29.2
  ✓ Docker running    daemon is responsive
  ✓ Docker memory     8.0 GB allocated (recommended: >= 4 GB)
  ✓ git               2.44.0
  ✓ ssh               OpenSSH 9.6
  ✓ Java              21.0.2
  ✓ curl              8.6.0

  Port Availability:
  ✓ 9000-9022         available (Global L0)
  ✓ 9200-9222         available (Metagraph L0)
  ✓ 9300-9322         available (Currency L1)
  ✓ 9400-9422         available (Data L1)

  Configuration:
  ✓ euclid.json       valid (v2)
  ✓ p12 files         3 key file(s) found
  ✓ project           data/project/my-metagraph exists

  All checks passed.
```

---

## Layers

Hydra orchestrates a multi-layer Constellation metagraph cluster:

| Layer | Description | Default Local Port |
|---|---|---|
| Global L0 | Base layer of the Constellation network | 9000 |
| DAG L1 | Data availability layer | 9100 |
| Metagraph L0 | Custom metagraph logic (L0) | 9200 |
| Currency L1 | Token/currency transactions | 9300 |
| Data L1 | Custom data processing | 9400 |

Each subsequent local node offsets ports by 10 (configurable via `docker.ip_offset`). For example, node-2 of Metagraph L0 runs on port 9210.

---

## Architecture

The codebase is a single TypeScript package with four modules:

### `src/core/`
Business logic SDK:
- **Config** — Zod schema validation, atomic file writes, automatic v1-to-v2 migration
- **Docker** — Container lifecycle management via `dockerode`, compose build/up/down
- **Cluster** — Layer orchestration, health polling (`/node/info`), persistent state
- **Errors** — Structured error hierarchy with actionable suggestions

### `src/cli/`
CLI commands built with `commander`. Each command is a thin wrapper that loads config, calls the core/remote module, and formats output for the terminal.

### `src/doctor/`
Environment verification: Docker version/health/memory, binary availability, port scanning, config validation, project structure checks.

### `src/remote/`
Remote SSH deployment via `node-ssh` (replaces the legacy Ansible playbooks):
- **ssh.ts** — SSH connection pooling, command execution, file upload
- **deploy.ts** — Transfer JARs, p12 keys, and genesis files to remote hosts
- **start.ts** — Sequential layer orchestration with health polling and cluster join
- **status.ts** — Query `/node/info` endpoints on all remote nodes
- **logs.ts** — Stream remote log files via SSH

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type-check without building
npm run typecheck

# Run the CLI in development (source maps enabled)
npm run hydra -- doctor

# Watch mode (auto-recompile on changes)
npm run dev
```

---

## Migrating from v1 (Legacy Hydra)

The v2 TypeScript CLI replaces the legacy bash-based Hydra CLI. This section covers everything you need to migrate an existing v1 project.

### Step 1: Configuration Migration

If you have an existing `euclid.json` from v1, the v2 CLI auto-migrates it on first run:

```bash
hydra doctor
# Output: "Detected legacy (v1) configuration — migrating to v2..."
# A backup is saved as euclid.v1.backup.json
```

Or migrate explicitly:

```bash
hydra config migrate
```

What changes during migration:
- `version` (Euclid version string) becomes `config_version: 2` (schema version number)
- `ref_type` becomes `tessellation_ref_type`
- `deploy.ansible` is removed (no longer needed)
- `deploy.hosts` is added as an empty array (you fill in your SSH hosts)
- `deploy.remote_ports` is added with defaults
- `docker` gets new optional fields (`network_subnet`, `base_ip_prefix`, `ip_offset`)
- `ports` section is added with defaults

### Step 2: Update Deploy Config

If you use remote deployment, update the `deploy` section in your migrated `euclid.json`:

**Before (v1 — Ansible-based):**
```json
{
  "deploy": {
    "network": { "name": "integrationnet", "gl0_node": { "..." : "..." } },
    "jvm": { "..." : "..." },
    "ansible": {
      "hosts": "infra/ansible/remote/hosts.ansible.yml",
      "nodes": { "playbooks": { "deploy": "...", "start": "..." } },
      "monitoring": { "playbooks": { "deploy": "...", "start": "..." } }
    }
  }
}
```

**After (v2 — native SSH):**
```json
{
  "deploy": {
    "network": { "name": "integrationnet", "gl0_node": { "..." : "..." } },
    "jvm": { "..." : "..." },
    "hosts": [
      { "host": "1.2.3.4", "user": "ubuntu", "ssh_key": "~/.ssh/id_rsa" },
      { "host": "5.6.7.8", "user": "ubuntu", "ssh_key": "~/.ssh/id_rsa" },
      { "host": "9.10.11.12", "user": "ubuntu", "ssh_key": "~/.ssh/id_rsa" }
    ],
    "monitoring_host": {
      "host": "10.0.0.1", "user": "ubuntu", "ssh_key": "~/.ssh/id_rsa"
    }
  }
}
```

The SSH host info that was previously in `infra/ansible/remote/hosts.ansible.yml` now lives directly in `euclid.json`.

### Step 3: Directory Changes

If you have scripts or tooling that reference the old directory names:

| v1 Path | v2 Path | Contents |
|---|---|---|
| `source/` | `data/` | Runtime data (p12 keys, genesis CSVs, project) |
| `infra/` | `docker/` | Docker images and build config |
| `infra/shared/` | `docker/artifacts/` | Build outputs (JARs, genesis files) |
| `infra/docker/custom/` | `docker/custom/` | Custom Dockerfile overrides |
| `source/p12-files/` | `data/p12-files/` | Node identity keys |
| `source/project/` | `data/project/` | Metagraph Scala project |
| `scripts/` | (removed) | Replaced by `src/cli/` TypeScript commands |
| `infra/ansible/` | (removed) | Replaced by `src/remote/` native SSH |

### Step 4: Command Migration

Full command mapping from v1 to v2:

| v1 Command | v2 Command |
|---|---|
| `scripts/hydra install` | `hydra install` |
| `scripts/hydra install-template` | `hydra install-template --name <name>` |
| `scripts/hydra install-monitoring-service` | `hydra install-monitoring-service` |
| `scripts/hydra build` | `hydra build` |
| `scripts/hydra start-genesis` | `hydra start --genesis` |
| `scripts/hydra start-rollback` | `hydra start` |
| `scripts/hydra stop` | `hydra stop` |
| `scripts/hydra destroy` | `hydra destroy` |
| `scripts/hydra purge` | `hydra purge` |
| `scripts/hydra status` | `hydra status` |
| `scripts/hydra logs <container> <layer>` | `hydra logs <layer>` |
| `scripts/hydra remote-deploy` | `hydra remote deploy` |
| `scripts/hydra remote-start` | `hydra remote start --genesis` |
| `scripts/hydra remote-status` | `hydra remote status` |
| `scripts/hydra remote-logs` | `hydra remote logs <host> <layer>` |
| `scripts/hydra remote-deploy-monitoring-service` | `hydra remote deploy-monitoring` |
| `scripts/hydra remote-start-monitoring-service` | `hydra remote start-monitoring` |
| `scripts/hydra remote-snapshot-fee-config` | `hydra remote snapshot-fee-config` |
| `scripts/hydra create-remote-genesis` | `hydra create-remote-genesis` |
| `scripts/hydra update <version>` | `hydra update <version>` |
| `check_seedlist` (called inside start) | `hydra check-seedlist <network>` |
| (none — new in v2) | `hydra doctor` |
| (none — new in v2) | `hydra config show` |
| (none — new in v2) | `hydra config validate` |
| (none — new in v2) | `hydra config migrate` |

### Dependencies Eliminated

| Was Required in v1 | Status in v2 |
|---|---|
| Rust/Cargo (for argc) | Removed — CLI built with `commander` |
| Python/Ansible | Removed — replaced by native SSH via `node-ssh` |
| Scala/Coursier/g8 | Removed — templates cloned via `git` |
| jq | Removed — Node.js handles JSON natively |
| yq | Removed — YAML config replaced by JSON |

The legacy v1 scripts are preserved in `legacy/scripts/` for reference.

---

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
