#!/usr/bin/env bash

function start_containers_remote_genesis() {
    echo_title "################################## START ##################################"
    check_ansible
    check_if_we_have_at_least_3_nodes
    check_p12_files

    export ANSIBLE_LOCALHOST_WARNING=False
    export ANSIBLE_INVENTORY_UNPARSED_WARNING=False

    if [[ "$DEPLOY_NETWORK_NAME" == "integrationnet|mainnet" ]] || \
    [[ "$DEPLOY_NETWORK_HOST_IP" == ":gl0_node_ip" ]] || \
    [[ "$DEPLOY_NETWORK_HOST_ID" == ":gl0_node_id" ]] || \
    [[ "$DEPLOY_NETWORK_HOST_PUBLIC_PORT" == ":gl0_node_public_port" ]]; then
        echo_red "❌ ERROR: euclid.json contains default placeholder values."
        echo_white "Please update $ROOT_PATH/euclid.json with real network configuration."
        exit 1
    fi

    export NETWORK_HOST_IP=$DEPLOY_NETWORK_HOST_IP
    export NETWORK_HOST_ID=$DEPLOY_NETWORK_HOST_ID
    export NETWORK_HOST_PUBLIC_PORT=$DEPLOY_NETWORK_HOST_PUBLIC_PORT

    check_network "$DEPLOY_NETWORK_NAME"
    echo "✅ Network configuration validated. Using network $DEPLOY_NETWORK_NAME"

    # The genesis embeds a reference (globalSyncView) to the latest global snapshot of the
    # GL0 node it is created against. If that node is not the target network, the metagraph
    # can never produce snapshot 2 there. Fail early instead of minting an unusable metagraph ID.
    local gl0_latest_url="http://$DEPLOY_NETWORK_HOST_IP:$DEPLOY_NETWORK_HOST_PUBLIC_PORT/global-snapshots/latest"
    local gl0_latest_ordinal
    gl0_latest_ordinal=$(curl -sf -m 15 -H "Accept: application/json" "$gl0_latest_url" | jq -r '.value.ordinal // empty' 2>/dev/null)
    if [[ -z "$gl0_latest_ordinal" ]]; then
        echo_red "❌ ERROR: Could not fetch the latest global snapshot from $gl0_latest_url"
        echo_white "The gl0_node configured in euclid.json must be a reachable, Ready $DEPLOY_NETWORK_NAME global L0 node."
        exit 1
    fi
    echo_green "✅ $DEPLOY_NETWORK_NAME global L0 reachable (latest global snapshot ordinal: $gl0_latest_ordinal)"
    export GENESIS_NETWORK=$DEPLOY_NETWORK_NAME

    try_start_docker_nodes
    try_start_global_l0 $1
    try_start_metagraph_l0 $1

    try_stop_containers

    echo_white ""
    echo_green "Genesis files for $DEPLOY_NETWORK_NAME written to infra/shared/genesis"
    echo_yellow "Do NOT run 'hydra start-genesis' before deploying: it overwrites these files with a genesis for the local docker hypergraph."
}
