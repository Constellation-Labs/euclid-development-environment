#!/usr/bin/env bash
function try_start_docker_nodes() {
    echo_white
    echo_white
    echo_title "################################################################"
    echo_yellow "Starting docker containers..."

    if pip3 --version &>/dev/null; then
        ansible-playbook $ANSIBLE_LOCAL_CONTAINERS_START_PLAYBOOK_FILE
    else
        echo_white ""
        echo_yellow "Ansible requires BECOME to install dependencies, please provide your sudo password"
        echo_white
        ansible-playbook -K $ANSIBLE_LOCAL_CONTAINERS_START_PLAYBOOK_FILE
    fi

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

function try_start_metagraph_l0() {
    if [[ " ${LAYERS[*]} " =~ "metagraph-l0" ]]; then
        echo_white
        echo_white

        echo_title "################################################################"
        echo_yellow "Starting metagraph l0 layer..."
        echo_white ""
        ansible-playbook -e "force_genesis=$1" $ANSIBLE_LOCAL_METAGRAPH_L0_START_PLAYBOOK_FILE
        if [ $? -eq 0 ]; then
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
    echo_url "Metagraph ID:" "$(cat $INFRA_PATH/docker/shared/genesis/genesis.address)"
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
