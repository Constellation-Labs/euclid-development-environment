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

    echo "✅ Network configuration validated. Using network $DEPLOY_NETWORK_NAME"

    try_start_docker_nodes
    try_start_global_l0 $1
    try_start_metagraph_l0 $1

    try_stop_containers
}
