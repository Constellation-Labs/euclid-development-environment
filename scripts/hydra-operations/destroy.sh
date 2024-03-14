#!/usr/bin/env bash

function destroy_container() {
    echo
    echo
    echo_title $2
    echo
    echo_white "Destroying $1 container"
    cd $INFRA_PATH/docker/$1
    $dockercompose down --remove-orphans
    echo_green "$1 container destroyed"
}

function destroy_containers() {
    echo_white "Starting destroying containers ..."

    if [[ ! -z "$argc_delete_project" ]]; then
        echo_white "Removing the project codebase $PROJECT_NAME..."
        rm -r source/project/$PROJECT_NAME 2>/dev/null
        echo_green "Removed!"
    fi

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "data-l1" ]] || [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-data" ]]; then
        destroy_container data-l1 "DATA-L1"
        rm -f infra/docker/shared/jars/data-l1.jar
    fi

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "currency-l1" ]] || [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-currency" ]]; then
        destroy_container currency-l1 "CURRENCY-L1"
        rm -f infra/docker/shared/jars/currency-l1.jar
    fi

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l0" ]]; then
        destroy_container metagraph-l0/genesis "METAGRAPH-L0-GENESIS"
        destroy_container metagraph-l0 "METAGRAPH-L0-VALIDATORS"
        rm -f infra/docker/shared/jars/metagraph-l0.jar
    fi

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "dag-l1" ]]; then
        destroy_container dag-l1 "DAG-L1"
        rm -f infra/docker/shared/jars/dag-l1.jar
    fi

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "global-l0" ]]; then
        destroy_container global-l0 "GLOBAL-L0"
        rm -f infra/docker/shared/jars/global-l0.jar
    fi

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "monitoring" ]]; then
        destroy_container monitoring "MONITORING"
    fi

    destroy_container metagraph-base-image "BASE-IMAGE"

    echo_white "Removing genesis.snapshot and genesis.address"
    rm -f source/metagraph-l0/genesis/genesis.address
    rm -f source/metagraph-l0/genesis/genesis.snapshot

    docker network rm custom-network
}
