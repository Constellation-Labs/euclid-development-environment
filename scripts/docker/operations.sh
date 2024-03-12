#!/usr/bin/env bash

function set_docker_compose() {
    if [ -x "$(command -v docker)" ] && [ "$(docker --version | awk '{print $3}' | cut -d'-' -f1 | cut -d'.' -f1)" -ge "20" ]; then
        # Version 2 syntax
        dockercompose="docker compose"
    elif [ -x "$(command -v docker-compose)" ]; then
        # Version 1 syntax
        dockercompose="docker-compose"
        echo_white ""
        echo_white "You only have the older docker compose installed. It should work fine for now."
        echo_white "The older syntax will be used... $dockercompose"
        echo_white ""
        echo_white "It is recommended that you install the latest version of docker compose for better compatibility in future hydra builds:"
        echo_white "  https://docs.docker.com/compose/install/linux/"
        echo_white ""
    else
        echo_red "Docker Compose not found"
        echo_red "To proceed, you need to make sure it is installed:"
        echo_white "  https://docs.docker.com/compose/install/linux/"
        exit 1
    fi
}

function check_if_docker_is_running() {
    if ! docker info &>/dev/null; then
        echo_red "You need to execute Docker service first to run the script."
        exit 1
    fi
}

function create_docker_custom_network() {
    echo_white
    echo_white "Creating docker custom-network..."
    if ! docker network inspect custom-network &>/dev/null; then
        docker network create --driver=bridge --subnet=172.50.0.0/24 custom-network
    fi
    echo_green "Network created"
}

function check_if_images_are_built() {
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "global-l0" ]]; then
        if ! docker inspect --type=image global-l0 &>/dev/null; then
            echo_red "You need to build the Global L0 first"
            exit 1
        fi
    fi
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l0" ]]; then
        if ! docker inspect --type=image metagraph-l0-initial-validator &>/dev/null; then
            echo_red "You need to build the Currency L0 first"
            exit 1
        fi
    fi
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "currency-l1" ]] || [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-currency" ]]; then
        if ! docker inspect --type=image currency-l1-initial-validator &>/dev/null; then
            echo_red "You need to build the Currency L1 first"
            exit 1
        fi
    fi

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "data-l1" ]] || [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-data" ]]; then
        if ! docker inspect --type=image data-l1-initial-validator &>/dev/null; then
            echo_red "You need to build the Data L1 first"
            exit 1
        fi
    fi

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "dag-l1" ]]; then
        if ! docker inspect --type=image dag-l1-initial-validator &>/dev/null; then
            echo_red "You need to build the DAG L1 first"
            exit 1
        fi
    fi
}
