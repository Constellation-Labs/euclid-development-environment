# Euclid Development Environment

Build, run, and deploy [Constellation Network](https://constellationnetwork.io/) metagraphs — locally with Docker or remotely via SSH.

Euclid provides the **Hydra CLI** (`hydra`) for the full metagraph lifecycle: scaffolding, building, running a local cluster, deploying to remote servers, and monitoring.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start — Local Cluster](#quick-start--local-cluster)
- [Quick Start — Remote Deployment](#quick-start--remote-deployment)
- [Interactive Mode](#interactive-mode)
- [Commands](#commands)
- [Configuration](#configuration)
- [Layers](#layers)
- [Remote Deployment](#remote-deployment)
- [Monitoring](#monitoring)
- [Updating Hydra](#updating-hydra)
- [Migrating from v1](#migrating-from-v1)
- [Project Structure](#project-structure)
- [Architecture & Code Quality](#architecture--code-quality)
- [Extending Hydra](#extending-hydra)
- [Development](#development)
- [License](#license)

---

## Prerequisites

| Dependency | Version  | Required? | Purpose                                     |
| ---------- | -------- | --------- | ------------------------------------------- |
| **Node.js**| >= 22    | Yes       | Runs the CLI (`.nvmrc` included)            |
| **Docker** | >= 26    | Yes       | Builds images, runs the local cluster       |
| **git**    | any      | Yes       | Clones templates and manages the project    |
| **ssh**    | any      | Remote only | SSH deployment to remote servers           |
| **Java 21**| 21       | Optional  | Seedlist verification (`check-seedlist`)    |

> **Hydra v1 vs v2:** Previous versions required Ansible, Rust/Cargo, jq, yq, and Scala/Coursier. Hydra v2 eliminates all of these — everything runs through Node.js and Docker.

---

## Installation

```bash
# 1. Install Node.js 22+ with nvm (skip if you already have it)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc   # or ~/.zshrc on macOS
nvm install 22

# 2. Make sure Docker is installed and running
docker info

# 3. Clone the repository
git clone https://github.com/Constellation-Labs/euclid-development-environment.git
cd euclid-development-environment

# 4. Install dependencies and build
nvm use              # reads .nvmrc → Node 22
npm install          # installs deps + auto-builds via postinstall

# 5. Make the CLI available globally
npm link

# 6. Verify your environment
hydra doctor
```

> You can also use `euclid` instead of `hydra` — both point to the same CLI.

---

## Quick Start — Local Cluster

This is the fastest way to get a metagraph running on your machine.

### Step 1: Set up a project

```bash
# Install a metagraph template (lists available templates first)
hydra install-template --list
hydra install-template --name my-metagraph

# Initialize git and create .gitignore
hydra install
```

### Step 2: Generate keys

Each node needs a `.p12` keystore file for its identity. Generate them with:

```bash
hydra keygen
```

This creates `.p12` files in `data/p12-files/` and can auto-update `euclid.json` with the new key references.

### Step 3: Build

```bash
hydra build
```

This compiles Tessellation JARs and your metagraph project inside Docker. The first build takes a few minutes — subsequent builds are faster thanks to Docker caching.

### Step 4: Start the cluster

```bash
# Start from genesis (fresh start, erases history)
hydra start --genesis

# Or resume from last state (rollback mode)
hydra start
```

### Step 5: Use it

```bash
# Check cluster health
hydra status

# Tail logs for a specific layer
hydra logs metagraph-l0

# Your metagraph endpoints are now available:
#   Metagraph L0  →  http://localhost:9200
#   Currency L1   →  http://localhost:9300
#   Data L1       →  http://localhost:9400
```

### Step 6: Development loop

Edit your Scala code in `data/project/<your-project>/`, then rebuild and restart:

```bash
hydra stop
hydra build
hydra start --genesis
```

### Step 7: Clean up

```bash
# Stop running containers
hydra stop

# Remove containers and network
hydra destroy --yes

# Full cleanup (containers + all Docker images)
hydra purge --yes
```

---

## Quick Start — Remote Deployment

Deploy your metagraph to remote servers (testnet, integrationnet, or mainnet).

### Step 1: Configure remote hosts

Edit the `deploy` section in `euclid.json`:

```jsonc
{
  "deploy": {
    "network": {
      "name": "integrationnet",
      "gl0_node": {
        "ip": "your-gl0-node-ip",
        "id": "your-gl0-node-peer-id",
        "public_port": 9000
      }
    },
    "hosts": [
      { "host": "1.2.3.4",    "user": "ubuntu", "ssh_key": "~/.ssh/id_rsa" },
      { "host": "5.6.7.8",    "user": "ubuntu", "ssh_key": "~/.ssh/id_rsa" },
      { "host": "9.10.11.12", "user": "ubuntu", "ssh_key": "~/.ssh/id_rsa" }
    ]
  }
}
```

> Hosts map 1:1 to nodes — host-1 runs node-1, host-2 runs node-2, etc.

### Step 2: Check seedlist (testnet/integrationnet/mainnet)

```bash
hydra check-seedlist integrationnet
```

### Step 3: Build and generate genesis

```bash
hydra build
hydra create-remote-genesis
```

This writes `genesis.snapshot`, `genesis.address`, and `genesis.meta.json` to
`docker/artifacts/genesis/`. **Back these files up (commit them to git)** — they
define your metagraph ID and cannot be regenerated with the same ID. The local
dev cluster uses a separate directory (`docker/artifacts/genesis-local/`), so
`hydra start --genesis` and `hydra destroy` never touch the remote genesis.

### Step 4: Deploy and start

```bash
# Upload JARs, keys, and genesis files to all hosts
hydra remote deploy --force-genesis

# Start the remote cluster
hydra remote start --genesis
```

### Step 5: Verify

```bash
# Check node health across all hosts
hydra remote status

# Tail logs on a specific host
hydra remote logs 1.2.3.4 metagraph-l0

# Check fee configuration
hydra remote snapshot-fee-config
```

---

## Interactive Mode

The recommended way to use Hydra. Run `hydra` with no arguments to launch the interactive menu:

```bash
hydra
```

The interactive menu shows a colored ASCII banner, detects your project, and displays live cluster status (running, stopped, degraded). All commands are organized into sections:

```
 ╦ ╦ ╦ ╦ ╔╦╗ ╦═╗ ╔═╗
 ╠═╣ ╚╦╝  ║║ ╠╦╝ ╠═╣
 ╩ ╩  ╩  ═╩╝ ╩╚═ ╩ ╩
 v2.0.0  │  Constellation Metagraph Toolkit

   project euclid.json  │  cluster ● running  │  9 nodes  4 layers

 ─── 🔍 Environment ─────────────────
   doctor, config show, config validate, config migrate

 ─── 📦 Project Setup ───────────────
   install, install-template

 ─── 🖥️  Local Cluster ───────────────
   build, start, stop, status, logs, destroy, purge

 ─── 🌐 Remote Deploy ───────────────
   create-remote-genesis, remote deploy, remote start,
   remote status, remote logs, remote stop, remote destroy,
   remote snapshot-fee

 ─── 📊 Monitoring ──────────────────
   install-monitoring, remote deploy-monitoring, remote start-monitoring

 ─── 🛠️  Utilities ───────────────────
   keygen, update, check-seedlist

   ⚙ Verbose mode [OFF]
   ✕ Exit
```

### Interactive Features

- **Context-aware prompts** — When you select `start`, it asks whether to run in genesis or rollback mode. When you select `logs`, it presents a layer picker. Remote commands ask for host selection where applicable.
- **Verbose toggle** — Switch debug output on/off from the bottom of the menu without restarting.
- **Cluster status** — The menu header shows live cluster state (running/stopped/degraded) with node and layer counts.
- **Loop mode** — After each command completes, you return to the menu to run another command. Press `Ctrl+C` or select "Exit" to quit.
- **No memorization needed** — Every command is listed with a description, so you never need to remember flags or subcommand syntax.

---

## Commands

### Environment & Setup

| Command                         | Description                                          |
| ------------------------------- | ---------------------------------------------------- |
| `hydra doctor`                  | Verify Docker, ports, config, and dependencies       |
| `hydra install`                 | Create `.gitignore` and initialize git repository    |
| `hydra install-template`        | Install a project from a Git template repository     |
| `hydra install-monitoring-service` | Download the metagraph monitoring service         |
| `hydra keygen`                  | Generate `.p12` keystore files for node identity     |
| `hydra update <version>`        | Update Hydra to a specific version from GitHub       |
| `hydra check-seedlist <network>`| Verify node peer IDs on a network seedlist           |

**`install-template` options:**

| Flag              | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `--name <name>`   | Template name to install                             |
| `--repo <url>`    | Git repository URL (default: `metagraph-examples`)   |
| `--path <path>`   | Path within the repository (default: `examples`)     |
| `--branch <branch>` | Branch to checkout                                |
| `--list`          | List available templates and exit                    |

### Configuration

| Command                | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `hydra config show`    | Display the current configuration               |
| `hydra config validate`| Validate `euclid.json` and report any issues    |
| `hydra config migrate` | Migrate a legacy v1 config to v2 format         |

### Local Cluster

| Command                   | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `hydra build [--no-cache]`| Build Docker images and compile metagraph JARs   |
| `hydra start [--genesis]` | Start the local cluster (rollback or genesis)    |
| `hydra stop`              | Stop all layers and containers                   |
| `hydra status`            | Show cluster health and node info                |
| `hydra logs <layer>`      | Tail logs for a layer (e.g. `metagraph-l0`)      |
| `hydra destroy [--yes]`   | Remove containers and network                    |
| `hydra purge [--yes]`     | Destroy + remove all Docker images               |

### Remote Deployment

| Command                               | Description                                     |
| ------------------------------------- | ----------------------------------------------- |
| `hydra create-remote-genesis`         | Generate genesis files locally for remote deploy |
| `hydra remote deploy [--force-genesis]`| Upload JARs, keys, and genesis to remote hosts  |
| `hydra remote start [--genesis]`      | Start the remote metagraph cluster               |
| `hydra remote status`                 | Check remote node health                         |
| `hydra remote logs <host> <layer>`    | Tail logs on a remote host                       |
| `hydra remote deploy-monitoring`      | Deploy monitoring service to remote host         |
| `hydra remote start-monitoring`       | Start monitoring service (`--force-restart`)     |
| `hydra remote snapshot-fee-config`    | Fetch snapshot fee config from remote metagraph  |
| `hydra update-owner`                  | Update metagraph owner signing message           |

### Global Flags

| Flag            | Description                          |
| --------------- | ------------------------------------ |
| `-v, --verbose` | Show detailed debug output           |
| `--json`        | Output as JSON (where supported)     |
| `--quiet`       | Suppress non-essential output        |
| `--version`     | Show CLI version                     |
| `--help`        | Show help for any command            |

---

## Configuration

Hydra uses `euclid.json` at the project root. The CLI auto-discovers it by walking up the directory tree.

### Full Config Reference

```jsonc
{
  // ─── Meta ─────────────────────────────────────────────────
  "config_version": 2,

  // ─── Project ──────────────────────────────────────────────
  "project_name": "my-metagraph",
  "tessellation_version": "4.0.0-rc.0",
  "tessellation_ref_type": "tag",           // "tag" or "branch"
  "framework": {
    "name": "currency",
    "modules": ["data"],                    // include "data" for Data L1 support
    "version": "v3.6.0",
    "ref_type": "tag"
  },

  // ─── Topology ─────────────────────────────────────────────
  "layers": [
    "global-l0",
    "metagraph-l0",
    "currency-l1",
    "data-l1"
  ],
  "nodes": [
    {
      "name": "metagraph-node-1",
      "key_file": {
        "name": "token-key.p12",
        "alias": "token-key",
        "password": "password"
      }
    },
    {
      "name": "metagraph-node-2",
      "key_file": {
        "name": "token-key-1.p12",
        "alias": "token-key-1",
        "password": "password"
      }
    },
    {
      "name": "metagraph-node-3",
      "key_file": {
        "name": "token-key-2.p12",
        "alias": "token-key-2",
        "password": "password"
      }
    }
  ],

  // ─── Docker (optional, defaults shown) ────────────────────
  "docker": {
    "start_grafana_container": false,
    "network_subnet": "172.50.0.0/24",
    "base_ip_prefix": "172.50.0.",
    "ip_offset": 10
  },

  // ─── Local Ports (optional, defaults shown) ───────────────
  "ports": {
    "global_l0":    { "public": 9000, "p2p": 9001, "cli": 9002 },
    "dag_l1":       { "public": 9100, "p2p": 9101, "cli": 9102 },
    "metagraph_l0": { "public": 9200, "p2p": 9201, "cli": 9202 },
    "currency_l1":  { "public": 9300, "p2p": 9301, "cli": 9302 },
    "data_l1":      { "public": 9400, "p2p": 9401, "cli": 9402 }
  },

  // ─── Snapshot Fees (optional) ─────────────────────────────
  "snapshot_fees": {
    "owner": {
      "key_file": { "name": "owner.p12", "alias": "owner", "password": "pass" }
    },
    "staking": {
      "key_file": { "name": "staking.p12", "alias": "staking", "password": "pass" }
    }
  },

  // ─── Remote Deployment (optional) ─────────────────────────
  "deploy": {
    "network": {
      "name": "integrationnet",            // "testnet", "integrationnet", or "mainnet"
      "gl0_node": {
        "ip": "your-gl0-node-ip",
        "id": "your-gl0-node-peer-id",
        "public_port": 9000
      }
    },
    "jvm": {
      "metagraph_l0": { "xms": "1g", "xmx": "4g" },
      "currency_l1":  { "xms": "1g", "xmx": "2g" },
      "data_l1":      { "xms": "1g", "xmx": "2g" }
    },
    "hosts": [
      { "host": "1.2.3.4",    "user": "ubuntu", "ssh_key": "~/.ssh/id_rsa" },
      { "host": "5.6.7.8",    "user": "ubuntu", "ssh_key": "~/.ssh/id_rsa" },
      { "host": "9.10.11.12", "user": "ubuntu", "ssh_key": "~/.ssh/id_rsa" }
    ],
    "remote_ports": {
      "metagraph_l0": { "public": 9100, "p2p": 9101, "cli": 9102 },
      "currency_l1":  { "public": 9200, "p2p": 9201, "cli": 9202 },
      "data_l1":      { "public": 9300, "p2p": 9301, "cli": 9302 }
    },
    "monitoring_host": {
      "host": "10.0.0.1",
      "user": "ubuntu",
      "ssh_key": "~/.ssh/id_rsa"
    }
  }
}
```

### Configuration Notes

- **`hosts` ↔ `nodes`** — They map 1:1. Host-1 runs node-1, host-2 runs node-2, etc.
- **`remote_ports`** — Different from local ports because each remote host runs one node (not multiple containers).
- **`jvm`** — Each layer has its own `-Xms` / `-Xmx` heap settings. Defaults: 1g min for all layers; max 4g for Metagraph L0, 2g for Currency L1 and Data L1. Values must be like `"8g"` or `"512m"`.
- **`monitoring_host`** — Used by `remote deploy-monitoring` and `remote start-monitoring`.
- **`docker`**, **`ports`**, **`jvm`**, and **`remote_ports`** all have sensible defaults — you only need to set them if you want to customize.

---

## Layers

Hydra orchestrates a multi-layer Constellation metagraph cluster:

| Layer          | Description                              | Default Local Port |
| -------------- | ---------------------------------------- | ------------------ |
| Global L0      | Base layer of the Constellation network  | 9000               |
| DAG L1         | Data availability layer                  | 9100               |
| Metagraph L0   | Custom metagraph logic (orderer)         | 9200               |
| Currency L1    | Token/currency transactions              | 9300               |
| Data L1        | Custom data processing                   | 9400               |

**Start order:** Global L0 → DAG L1 → Metagraph L0 → Currency L1 → Data L1

Each local node offsets ports by 10 (configurable via `docker.ip_offset`). For example, node-2 of Metagraph L0 runs on port 9210.

---

## Remote Deployment

Hydra v2 uses native SSH (via `node-ssh`) for remote deployment — no Ansible required.

### What gets deployed

`hydra remote deploy` uploads the following to each host:

| What                        | Destination                              |
| --------------------------- | ---------------------------------------- |
| Tessellation JARs           | `/home/<user>/code/<layer>/`             |
| Metagraph JARs              | `/home/<user>/code/<layer>/`             |
| Node `.p12` key             | `/home/<user>/code/<layer>/`             |
| Genesis files               | `/home/<user>/code/metagraph-l0/`        |
| Snapshot fee `.p12` files   | `/home/<user>/code/metagraph-l0/`        |

### How remote start works

`hydra remote start` follows strict layer ordering:

1. **Metagraph L0**
   - Start genesis node on host-1 → wait for `Ready` state
   - Extract peer ID from node-1
   - Start validators on host-2, host-3 → wait for `ReadyToJoin`
   - Join each validator to the cluster

2. **Currency L1** (if enabled)
   - Start initial validator on host-1 → wait for `Ready`
   - Start validators on host-2, host-3 → join cluster

3. **Data L1** (if enabled)
   - Same pattern as Currency L1

Each step includes health polling with retries and process crash detection. Press `Ctrl+C` at any time for graceful cleanup.

### Remote ports

Remote ports differ from local ports since each host runs one node:

| Layer          | Public | P2P  | CLI  |
| -------------- | ------ | ---- | ---- |
| Metagraph L0   | 9100   | 9101 | 9102 |
| Currency L1    | 9200   | 9201 | 9202 |
| Data L1        | 9300   | 9301 | 9302 |

Customize via `deploy.remote_ports` in `euclid.json`.

---

## Monitoring

### Setup

```bash
# 1. Install monitoring service locally
hydra install-monitoring-service

# 2. Edit the monitoring config
#    data/metagraph-monitoring-service/config/config.json
#    → Fill in network node IPs, ports, peer IDs
#    → Fill in metagraph node IPs, SSH usernames, key paths

# 3. Add monitoring_host to euclid.json (inside deploy section)
#    "monitoring_host": { "host": "10.0.0.1", "user": "ubuntu", "ssh_key": "~/.ssh/id_rsa" }

# 4. Deploy to the monitoring host
hydra remote deploy-monitoring

# 5. Start the service
hydra remote start-monitoring

# Force restart if already running
hydra remote start-monitoring --force-restart
```

---

## Updating Hydra

When a new version is released:

```bash
# Stop any running containers first
hydra stop

# Update to a specific version
hydra update v2.1.0

# Or skip the confirmation prompt
hydra update v2.1.0 --yes
```

This replaces `docker/`, `src/`, and config files from the new version, then rebuilds automatically. Your `euclid.json`, `data/`, and `docker/custom/` are preserved.

---

## Migrating from v1

### Step 1: Migrate the config

The v2 CLI auto-migrates `euclid.json` on first run:

```bash
hydra doctor
# → "Detected legacy (v1) configuration — migrating to v2..."
# → Backup saved as euclid.v1.backup.json
```

Or migrate explicitly:

```bash
hydra config migrate
```

**What changes:**

| v1                            | v2                                                |
| ----------------------------- | ------------------------------------------------- |
| `version` (Euclid string)    | `config_version: 2`                               |
| `ref_type`                    | `tessellation_ref_type`                            |
| `deploy.ansible`              | Removed (replaced by `deploy.hosts`)              |
| `deploy.jvm` (flat object)   | `deploy.jvm` with per-layer `xms`/`xmx` settings |
| (not present)                 | `deploy.hosts` (SSH hosts array)                  |
| (not present)                 | `deploy.remote_ports`                             |
| (not present)                 | `docker` section                                  |
| (not present)                 | `ports` section                                   |

### Step 2: Update deploy config

If you use remote deployment, fill in the `deploy.hosts` array with your SSH connection info (this was previously in `infra/ansible/remote/hosts.ansible.yml`).

### Step 3: Directory changes

| v1 Path                   | v2 Path              | Contents                        |
| ------------------------- | -------------------- | ------------------------------- |
| `source/`                 | `data/`              | Runtime data (keys, genesis)    |
| `infra/`                  | `docker/`            | Docker images and build config  |
| `infra/shared/`           | `docker/artifacts/`  | Build outputs (JARs, genesis)   |
| `source/p12-files/`       | `data/p12-files/`    | Node identity keys              |
| `source/project/`         | `data/project/`      | Metagraph Scala project         |
| `scripts/`                | Removed              | Replaced by TypeScript CLI      |
| `infra/ansible/`          | Removed              | Replaced by native SSH          |

### Step 4: Command mapping

| v1 Command                              | v2 Command                      |
| --------------------------------------- | ------------------------------- |
| `scripts/hydra build`                   | `hydra build`                   |
| `scripts/hydra start-genesis`           | `hydra start --genesis`         |
| `scripts/hydra start-rollback`          | `hydra start`                   |
| `scripts/hydra stop`                    | `hydra stop`                    |
| `scripts/hydra destroy`                 | `hydra destroy`                 |
| `scripts/hydra purge`                   | `hydra purge`                   |
| `scripts/hydra status`                  | `hydra status`                  |
| `scripts/hydra remote-deploy`           | `hydra remote deploy`           |
| `scripts/hydra remote-start`            | `hydra remote start --genesis`  |
| `scripts/hydra remote-status`           | `hydra remote status`           |
| `scripts/hydra create-remote-genesis`   | `hydra create-remote-genesis`   |
| `scripts/hydra update <version>`        | `hydra update <version>`        |

### Dependencies eliminated

| Was required in v1         | Status in v2                              |
| -------------------------- | ----------------------------------------- |
| Rust/Cargo (for argc)      | Removed — CLI built with Commander.js     |
| Python/Ansible             | Removed — replaced by native SSH          |
| Scala/Coursier/g8          | Removed — templates cloned via git        |
| jq                         | Removed — Node.js handles JSON natively   |
| yq                         | Removed — YAML config replaced by JSON    |

---

## Project Structure

```
euclid-development-environment/
├── src/main/
│   ├── cli/                          # CLI entry point and commands
│   │   ├── index.ts                  # Commander.js program definition
│   │   ├── commands/
│   │   │   ├── cluster/              # build, start, stop, status, logs, destroy, purge
│   │   │   ├── config/               # show, validate, migrate
│   │   │   ├── setup/                # doctor, install, keygen, update, check-seedlist,
│   │   │   │                         #   install-template, install-monitoring-service
│   │   │   ├── remote/               # deploy, start, status, logs, monitoring,
│   │   │   │                         #   create-genesis, snapshot-fee-config
│   │   │   └── update-owner.ts       # Owner signing message management
│   │   ├── menu/                     # Interactive mode and prerequisites
│   │   │   ├── interactive.ts        # Main interactive menu loop
│   │   │   └── prerequisites.ts      # Pre-flight environment checks
│   │   └── ui/                       # Colors, icons, tables, spinners
│   │       ├── format.ts             # Doctor reports, errors, tables
│   │       ├── theme.ts              # Color palette and icon set
│   │       └── spinner.ts            # Animated progress indicators
│   ├── config/                       # Configuration management
│   │   ├── schema.ts                 # Zod v2 schema + JVM config resolution
│   │   ├── loader.ts                 # Auto-discovery, parse, validate, migrate
│   │   ├── migration.ts              # v1 → v2 config migration
│   │   └── writer.ts                 # Atomic JSON writes (temp + rename)
│   ├── docker-client/                # Docker container lifecycle
│   │   ├── client.ts                 # Container, image, network ops via dockerode
│   │   └── compose.ts               # Docker Compose integration
│   ├── cluster/                      # Local cluster orchestration
│   │   ├── health.ts                 # Node polling, state waiting, cluster info
│   │   ├── layer.ts                  # Port/IP computation per layer
│   │   ├── fees.ts                   # Snapshot fee signing and proof combining
│   │   ├── state.ts                  # Cluster state persistence
│   │   └── starters/                 # Per-layer startup logic
│   │       ├── helpers.ts            # Shared utilities (exec, copy, join, wait)
│   │       ├── lead-node.ts          # Lead node ID extraction
│   │       ├── global-l0.ts          # Global L0 genesis/rollback with snapshot hash
│   │       ├── dag-l1.ts             # DAG L1 initial-validator + join
│   │       ├── metagraph-l0.ts       # Metagraph L0 genesis/rollback + owner message
│   │       ├── currency-l1.ts        # Currency L1 startup
│   │       ├── data-l1.ts            # Data L1 startup
│   │       └── l1-shared.ts          # Shared L1 layer start logic
│   ├── doctor/                       # Environment verification checks
│   │   ├── index.ts                  # Check runner and report builder
│   │   └── checks/                   # Individual checks (docker, ports, config, etc.)
│   ├── remote/                       # SSH-based remote deployment
│   │   ├── ssh.ts                    # Connection pooling, retry with backoff
│   │   ├── deploy.ts                 # Parallel file transfer to remote hosts
│   │   ├── start.ts                  # Layer-by-layer remote orchestration
│   │   ├── status.ts                 # Remote health queries
│   │   ├── logs.ts                   # Remote log streaming via SSH
│   │   ├── stop.ts                   # Remote process stop
│   │   ├── destroy.ts                # Remote cleanup
│   │   ├── defaults.ts               # Default remote port configuration
│   │   └── paths.ts                  # Remote directory path resolution
│   └── shared/                       # Cross-cutting concerns
│       ├── errors.ts                 # Domain error hierarchy with .format()
│       ├── logger.ts                 # Structured logger with secret redaction
│       ├── preflight.ts              # Runtime environment validation
│       └── gitignore.ts              # Default .gitignore template
├── src/tests/                        # Vitest test suites (258 tests)
│   ├── cli/                          # CLI formatting tests
│   ├── cluster/                      # Health, fees, layer, state tests
│   ├── config/                       # Schema, loader, migration, writer tests
│   └── shared/                       # Error hierarchy, logger, preflight tests
├── docker/
│   ├── metagraph-ubuntu/             # Base image: Ubuntu + Java + Tessellation
│   ├── metagraph-base-image/         # Project image: compiles metagraph JARs
│   ├── custom/                       # Drop a custom Dockerfile here to override
│   ├── grafana/                      # Prometheus + Grafana monitoring stack
│   └── artifacts/
│       ├── jars/                     # Compiled JARs
│       ├── genesis/                  # REMOTE genesis (defines metagraph ID — back it up!)
│       └── genesis-local/            # Local dev-cluster genesis (throwaway)
├── data/
│   ├── p12-files/                    # Node identity keys (.p12)
│   ├── metagraph-l0/genesis/         # Genesis CSV
│   ├── project/                      # Your metagraph Scala project
│   └── metagraph-monitoring-service/ # Monitoring service (if installed)
├── euclid.json                       # Project configuration
├── package.json
├── tsconfig.json
├── eslint.config.js
├── vitest.config.ts
└── .nvmrc                            # Node.js 22
```

---

## Architecture & Code Quality

### Tech Stack

| Component          | Technology                                 |
| ------------------ | ------------------------------------------ |
| Language           | TypeScript 5.7+ (strict mode, ESM)         |
| Runtime            | Node.js >= 22                              |
| CLI Framework      | Commander.js                               |
| Config Validation  | Zod schemas                                |
| Docker Client      | dockerode                                  |
| SSH Client         | node-ssh                                   |
| Interactive UI     | @inquirer/prompts                          |
| Testing            | Vitest (258 tests, 13 suites)              |
| Linting            | ESLint + Prettier                          |

### Error Handling

The codebase uses a domain-specific error hierarchy rooted in `HydraError`:

| Error Class           | Used For                                       |
| --------------------- | ---------------------------------------------- |
| `ConfigError`         | Config file parsing, validation, missing files |
| `ConfigNotFoundError` | Config file not found on disk                  |
| `ConfigValidationError` | Zod schema validation failures              |
| `LayerStartError`     | Local cluster layer start/rollback failures    |
| `SSHConnectionError`  | SSH connection, exec, and upload failures      |
| `RemoteStartError`    | Remote layer orchestration failures            |
| `RemoteDeployError`   | File transfer and deploy failures              |

All errors implement `.format()` for consistent, human-readable CLI output. The `errorMessage(err)` utility safely extracts messages from unknown error types.

### Safety Practices

- **Shell injection prevention** — All shell interpolations are quoted; curl payloads escape single quotes
- **Atomic config writes** — Config is written to a temp file then renamed (no data loss on crash)
- **Type-safe error handling** — No `(err as Error)` casts; uses `errorMessage()` or `instanceof` guards
- **No non-null assertions** — All optional values are guarded with explicit runtime checks
- **TOCTOU prevention** — File existence checks use try/catch `readFile` instead of `existsSync` + `readFile` where possible
- **Docker version compatibility** — Pre-release version suffixes are stripped before comparison
- **Graceful signal handling** — `SIGINT`/`SIGTERM` handlers clean up SSH connections before exit
- **Secret redaction** — The structured logger automatically redacts known secret fields

---

## Extending Hydra

The codebase is designed for easy extension. Adding a new command to both the interactive menu and the CLI takes just a few steps and a handful of lines of wiring code — most of your time goes into the actual business logic, not the plumbing.

### Adding a New Command

**Step 1 — Create the command function** (one new file)

Every command is a single exported async function in `src/main/cli/commands/<category>/`. They all follow the same shape:

```typescript
// src/main/cli/commands/setup/my-feature.ts
import { logger, LogLevel } from '../../../index.js';

export async function myFeatureCommand(options: {
  verbose?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);
  // ... your logic here
}
```

Pick a category folder that fits (`cluster/`, `remote/`, `setup/`, `config/`) or create a new one.

**Step 2 — Wire it into the interactive menu** (`src/main/cli/menu/interactive.ts`)

Three small additions:

```typescript
// 1. Import at the top
import { myFeatureCommand } from '../commands/setup/my-feature.js';

// 2. Add an entry to buildMenuChoices() — it's a flat array
{
  name: `my-feature                ${t.dim('Short description here')}`,
  value: 'my-feature',
},

// 3. Add a case to the executeCommand() switch
case 'my-feature':
  return myFeatureCommand({ verbose });
```

If your command needs user input (like picking a layer or confirming an action), add the `@inquirer/prompts` calls inline:

```typescript
case 'my-feature': {
  const target = await select({
    message: 'Which target?',
    choices: [
      { name: 'Option A', value: 'a' },
      { name: 'Option B', value: 'b' },
    ],
  });
  return myFeatureCommand({ target, verbose });
}
```

**Step 3 (optional) — Register as a direct CLI command** (`src/main/cli/index.ts`)

This lets users also run `hydra my-feature` without the interactive menu:

```typescript
program
  .command('my-feature')
  .description('Short description here')
  .action(async () => {
    const opts = program.opts();
    await myFeatureCommand({ verbose: opts.verbose });
  });
```

**Step 4 (optional) — Add prerequisites** (`src/main/cli/menu/prerequisites.ts`)

If your command depends on another step (e.g., build must run first), add an entry:

```typescript
'my-feature': [
  {
    label: 'Docker images not found. The project needs to be built first.',
    command: 'build',
    commandLabel: 'build',
    check: async () => dockerImageExists(),
  },
],
```

The interactive menu will **automatically prompt** the user to run the prerequisite if it's not met, and it chains them (e.g., `remote:start` → `remote:deploy` → `build`).

### Adding a New Menu Section

To create an entirely new section in the interactive menu, use the `section()` helper inside `buildMenuChoices()`:

```typescript
...section('🔄', 'Migration'),
{ name: `migrate-data  ${t.dim('Migrate snapshot data')}`, value: 'migrate-data' },
{ name: `migrate-keys  ${t.dim('Re-encrypt p12 files')}`, value: 'migrate-keys' },
```

### What You Get for Free

Every new command automatically inherits:

- **Safe execution wrapper** — `runCommandSafe()` intercepts `process.exit()` so errors return to the menu instead of killing the process
- **Verbose toggle** — The global verbose/debug mode works without any extra code
- **Loop mode** — After your command finishes, the user returns to the menu
- **Error formatting** — Throw any `HydraError` subclass and it gets formatted with context, suggestion, and cause chain
- **Shared infrastructure** — Docker client, SSH connection pool, config loader, structured logger, and the full domain error hierarchy are all available as imports

### Effort Estimate

| What you're adding | Typical effort |
| --- | --- |
| Simple command (no sub-prompts, like `doctor`) | ~30 minutes |
| Command with interactive prompts (like `start`) | ~1 hour |
| New menu section with 2–3 commands | ~2–3 hours |
| Prerequisite chain | ~15 minutes |

---

## Development

```bash
# Install dependencies
npm install

# Build (src/main/ → dist/)
npm run build

# Watch mode (auto-recompile on changes)
npm run dev

# Run tests
npm test

# Type-check without building
npm run typecheck

# Lint and format
npm run lint
npm run lint:fix
npm run format

# Run the CLI in dev mode (with source maps)
npm run hydra -- doctor

# Clean build artifacts
npm run clean
```

---

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
