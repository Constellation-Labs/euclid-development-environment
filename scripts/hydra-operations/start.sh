#!/usr/bin/env bash
function try_start_docker_nodes() {
    echo_white
    echo_white
    echo_title "################################################################"
    echo_yellow "Starting docker containers..."

    ansible-playbook $ANSIBLE_LOCAL_CONTAINERS_START_PLAYBOOK_FILE

    if [ $? -eq 0 ]; then
        echo_green "Nodes containers started successfully."
    else
        echo_red "Failing when starting nodes containers, take a look at the logs."
        exit 1
    fi
    echo_title "################################################################"
}

function try_start_global_l0() {
    if [[ " ${LAYERS[*]} " =~ "global-l0" ]]; then
        echo_white
        echo_white

        echo_title "################################################################"
        echo_yellow "Starting global-l0 layer..."
        echo_white ""
        ansible-playbook -e "force_genesis=$1" $ANSIBLE_LOCAL_GLOBAL_L0_START_PLAYBOOK_FILE
        if [ $? -eq 0 ]; then
            echo_green "global-l0 started successfully"
        else
            echo_red "Failing when starting global-l0, take a look at the logs."
            exit 1
        fi
        echo_title "################################################################"
    fi
}

function try_start_dag_l1() {
    if [[ " ${LAYERS[*]} " =~ "dag-l1" ]]; then
        echo_white
        echo_white

        echo_title "################################################################"
        echo_yellow "Starting dag-l1 layer..."
        echo_white ""
        ansible-playbook -e "force_genesis=$1" $ANSIBLE_LOCAL_DAG_L1_START_PLAYBOOK_FILE
        if [ $? -eq 0 ]; then
            echo_green "dag-l1 started successfully"
        else
            echo_red "Failing when starting dag-l1, take a look at the logs."
            exit 1
        fi
        echo_title "################################################################"
    fi
}

# A genesis embeds a reference to the global L0 snapshot it was created against.
# Bind that network to the generated files so remote-deploy / remote-start can
# verify the exact artifacts they are about to use.
function genesis_file_sha256() {
    local checksum_output

    if command -v sha256sum >/dev/null 2>&1; then
        checksum_output=$(sha256sum "$1") || return 1
    elif command -v shasum >/dev/null 2>&1; then
        checksum_output=$(shasum -a 256 "$1") || return 1
    else
        echo_red "Neither sha256sum nor shasum is installed; cannot record genesis provenance."
        return 1
    fi

    printf '%s\n' "${checksum_output%%[[:space:]]*}"
}

function invalidate_genesis_provenance() {
    rm -f "$INFRA_PATH/shared/genesis/genesis.provenance.json"
}

function record_genesis_provenance() {
    local genesis_network="${GENESIS_NETWORK:-local}"
    local genesis_directory="$INFRA_PATH/shared/genesis"
    local address_path="$genesis_directory/genesis.address"
    local snapshot_path="$genesis_directory/genesis.snapshot"
    local provenance_path="$genesis_directory/genesis.provenance.json"
    local temporary_provenance_path="$provenance_path.tmp"
    local address_sha256
    local snapshot_sha256

    if [[ ! -f "$address_path" || ! -f "$snapshot_path" ]]; then
        echo_red "Genesis generation did not produce both genesis.address and genesis.snapshot."
        return 1
    fi

    address_sha256=$(genesis_file_sha256 "$address_path") || return 1
    snapshot_sha256=$(genesis_file_sha256 "$snapshot_path") || return 1

    if ! jq -n \
        --arg network "$genesis_network" \
        --arg address_sha256 "$address_sha256" \
        --arg snapshot_sha256 "$snapshot_sha256" \
        '{version: 1, network: $network, address_sha256: $address_sha256, snapshot_sha256: $snapshot_sha256}' \
        > "$temporary_provenance_path"; then
        rm -f "$temporary_provenance_path"
        echo_red "Could not write genesis provenance."
        return 1
    fi

    if ! mv -f "$temporary_provenance_path" "$provenance_path"; then
        rm -f "$temporary_provenance_path"
        echo_red "Could not publish genesis provenance."
        return 1
    fi
    echo_white "Genesis created against network: $genesis_network (recorded in infra/shared/genesis/genesis.provenance.json)"
}

function try_start_metagraph_l0() {
    if [[ " ${LAYERS[*]} " =~ "metagraph-l0" ]]; then
        echo_white
        echo_white

        echo_title "################################################################"
        echo_yellow "Starting metagraph l0 layer..."
        echo_white ""
        if [ "$1" = "true" ]; then
            # Never let a failed regeneration leave provenance for the previous files.
            if ! invalidate_genesis_provenance; then
                echo_red "Could not invalidate the previous genesis provenance."
                exit 1
            fi
        fi
        ansible-playbook -e "force_genesis=$1" -e "network_host_ip=$NETWORK_HOST_IP" -e "network_host_id=$NETWORK_HOST_ID" -e "network_host_public_port=$NETWORK_HOST_PUBLIC_PORT" $ANSIBLE_LOCAL_METAGRAPH_L0_START_PLAYBOOK_FILE
        if [ $? -eq 0 ]; then
            if [ "$1" = "true" ]; then
                record_genesis_provenance || exit 1
            fi
            echo_green "metagraph-l0 started successfully"
        else
            echo_red "Failing when starting metagraph-l0, take a look at the logs."
            exit 1
        fi
        echo_title "################################################################"
    fi
}

function try_start_currency_l1() {
    if [[ " ${LAYERS[*]} " =~ "currency-l1" ]] || [[ " ${LAYERS[*]} " =~ "metagraph-l1-currency" ]]; then
        echo_white
        echo_white

        echo_title "################################################################"
        echo_yellow "Starting currency l1 layer..."
        echo_white ""
        ansible-playbook $ANSIBLE_LOCAL_CURRENCY_L1_START_PLAYBOOK_FILE
        if [ $? -eq 0 ]; then
            echo_green "currency-l1 started successfully"
        else
            echo_red "Failing when starting currency-l1, take a look at the logs."
            exit 1
        fi
        echo_title "################################################################"
    fi
}

function try_start_data_l1() {
    if [[ " ${LAYERS[*]} " =~ "data-l1" ]] || [[ " ${LAYERS[*]} " =~ "metagraph-l1-data" ]]; then
        echo_white
        echo_white
        echo_title "################################################################"
        echo_yellow "Starting data l1 layer..."
        echo_white ""
        ansible-playbook $ANSIBLE_LOCAL_DATA_L1_START_PLAYBOOK_FILE
        if [ $? -eq 0 ]; then
            echo_green "data-l1 started successfully"
        else
            echo_red "Failing when starting data-l1, take a look at the logs."
            exit 1
        fi
        echo_title "################################################################"
    fi
}

function try_start_grafana() {
    if [ "$START_GRAFANA_CONTAINER" = "true" ]; then
        echo_white
        echo_white
        echo_title "################################################################"
        echo_yellow "Starting grafana container"
        echo_white ""
        ansible-playbook $ANSIBLE_LOCAL_GRAFANA_START_PLAYBOOK_FILE

        if [ $? -eq 0 ]; then
            echo_green "Monitor container started successfully."
        else
            echo_red "Failing when starting monitor container, take a look at the logs."
            exit 1
        fi
        echo_title "################################################################"
    fi
}

function print_nodes_information() {
    ansible_vars_path=$ANSIBLE_LOCAL_VARS
    offset=$(yq eval '.offset' $ansible_vars_path)
    index=0

    echo_white "######################### METAGRAPH INFO #########################"
    echo
    echo_url "Metagraph ID:" "$(cat $INFRA_PATH/shared/genesis/genesis.address)"
    echo
    echo

    while IFS= read -r node; do
        name=$(jq -r '.name' <<<"$node")
        echo_green "Container $name URLs"

        if [[ $index -eq 0 ]] && [[ " ${LAYERS[*]} " =~ "global-l0" ]]; then
            raw_port=$(yq eval '.base_global_l0_public_port' $ansible_vars_path)
            echo_url "Global L0:" "http://localhost:$raw_port/node/info"
        fi

        if [[ " ${LAYERS[*]} " =~ "dag-l1" ]]; then
            raw_port=$(yq eval '.base_dag_l1_public_port' $ansible_vars_path)
            port=$(($raw_port + $index * $offset))
            echo_url "DAG L1:" "http://localhost:$port/node/info"
        fi

        if [[ " ${LAYERS[*]} " =~ "metagraph-l0" ]]; then
            raw_port=$(yq eval '.base_metagraph_l0_public_port' $ansible_vars_path)
            port=$(($raw_port + $index * $offset))
            echo_url "Metagraph L0:" "http://localhost:$port/node/info"
        fi

        if [[ " ${LAYERS[*]} " =~ "currency-l1" ]] || [[ " ${LAYERS[*]} " =~ "metagraph-l1-currency" ]]; then
            raw_port=$(yq eval '.base_currency_l1_public_port' $ansible_vars_path)
            port=$(($raw_port + $index * $offset))
            echo_url "Currency L1:" "http://localhost:$port/node/info"
        fi

        if [[ " ${LAYERS[*]} " =~ "data-l1" ]] || [[ " ${LAYERS[*]} " =~ "metagraph-l1-data" ]]; then
            raw_port=$(yq eval '.base_data_l1_public_port' $ansible_vars_path)
            port=$(($raw_port + $index * $offset))
            echo_url "Data L1:" "http://localhost:$port/node/info"
        fi
        echo
        echo
        ((index++))
    done < <(jq -c '.[]' <<<"$NODES")

    if [[ "$START_GRAFANA_CONTAINER" == "true" ]]; then
        echo_green "Telemetry"
        echo_url "Grafana:" "http://localhost:3000"
        echo
    fi

    echo_green "Clusters URLs"
    if [[ " ${LAYERS[*]} " =~ "global-l0" ]]; then
        raw_port=$(yq eval '.base_global_l0_public_port' $ansible_vars_path)
        echo_url "Global L0:" "http://localhost:$raw_port/cluster/info"
    fi

    if [[ " ${LAYERS[*]} " =~ "dag-l1" ]]; then
        raw_port=$(yq eval '.base_dag_l1_public_port' $ansible_vars_path)
        echo_url "DAG L1:" "http://localhost:$raw_port/cluster/info"
    fi

    if [[ " ${LAYERS[*]} " =~ "metagraph-l0" ]]; then
        raw_port=$(yq eval '.base_metagraph_l0_public_port' $ansible_vars_path)
        echo_url "Metagraph L0:" "http://localhost:$raw_port/cluster/info"
    fi

    if [[ " ${LAYERS[*]} " =~ "currency-l1" ]] || [[ " ${LAYERS[*]} " =~ "metagraph-l1-currency" ]]; then
        raw_port=$(yq eval '.base_currency_l1_public_port' $ansible_vars_path)
        echo_url "Currency L1:" "http://localhost:$raw_port/cluster/info"
    fi

    if [[ " ${LAYERS[*]} " =~ "data-l1" ]] || [[ " ${LAYERS[*]} " =~ "metagraph-l1-data" ]]; then
        raw_port=$(yq eval '.base_data_l1_public_port' $ansible_vars_path)
        echo_url "Data L1:" "http://localhost:$raw_port/cluster/info"
    fi

    echo
}

function start_containers() {
    echo_title "################################## START ##################################"
    check_ansible
    check_if_we_have_at_least_3_nodes
    check_p12_files

    export ANSIBLE_LOCALHOST_WARNING=False
    export ANSIBLE_INVENTORY_UNPARSED_WARNING=False

    try_start_docker_nodes
    try_start_global_l0 $1
    try_start_dag_l1 $1
    try_start_metagraph_l0 $1
    try_start_currency_l1 $1
    try_start_data_l1 $1
    try_start_grafana

    print_nodes_information
    
}
