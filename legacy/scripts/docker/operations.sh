#!/usr/bin/env bash

function set_docker_compose() {
    if [ -x "$(command -v docker)" ] && [ "$(docker --version | awk '{print $3}' | cut -d'-' -f1 | cut -d'.' -f1)" -ge "20" ]; then
        # Version 2 syntax
        export DOCKER_COMPOSE="docker compose"
    elif [ -x "$(command -v docker-compose)" ]; then
        # Version 1 syntax
        export DOCKER_COMPOSE="docker-compose"
        echo_white ""
        echo_white "You only have the older docker compose installed. It should work fine for now."
        echo_white "The older syntax will be used... $DOCKER_COMPOSE"
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

    required_version="26.0.0"
    installed_version=$(docker --version | awk '{print $3}' | sed 's/,//')

    if [[ -z "$installed_version" ]]; then
        echo_red "Docker is not installed or not found in the PATH."
        exit 1
    fi

    if [[ "$(printf '%s\n' "$required_version" "$installed_version" | sort -V | head -n1)" != "$required_version" ]]; then
        echo_red "Docker version is lower than $required_version. Installed version: $installed_version"
        exit 1
    fi

    if [[ $(uname) == "Darwin" ]]; then
        DOCKER_SOCKET="/var/run/docker.sock"
        if [ ! -e "$DOCKER_SOCKET" ]; then
            echo_red "Could not find docker socket, be sure to enable the option"
            echo_white "Allow the default Docker socket to be used"
            echo_white "You can find this option in your Docker Desktop -> Settings -> Advanced"
            exit 1
        fi
    fi
}
