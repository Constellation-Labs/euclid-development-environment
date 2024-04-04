#!/usr/bin/env bash
function destroy_containers() {
    echo_white "################################## DESTROY ##################################"
    echo_white "Starting destroying containers ..."
    while IFS= read -r node; do
        name=$(jq -r '.name' <<<"$node")

        echo_white "Trying to destroy container $name ..."
        if docker inspect $name &>/dev/null; then
            docker rm -f $name
            echo_green "Container $name removed successfully."
        else
            echo_yellow "Container $name does not exist."
        fi
        echo
        echo
    done < <(jq -c '.[]' <<<"$NODES")

    echo_white "Trying to destroy container grafana ..."
    if docker inspect grafana &>/dev/null; then
        docker rm -f $name
        echo_green "Container grafana removed successfully."
    else
        echo_yellow "Container grafana does not exist."
    fi

    echo
    echo

    echo_white "Trying to destroy container prometheus ..."
    if docker inspect prometheus &>/dev/null; then
        docker rm -f $name
        echo_green "Container prometheus removed successfully."
    else
        echo_yellow "Container prometheus does not exist."
    fi

    echo
    echo

    rm -f $INFRA_PATH/docker/shared/genesis/genesis.address
    rm -f $INFRA_PATH/docker/shared/genesis/genesis.snapshot

    echo_white "Trying to remove network custom-network ..."
    if docker network inspect custom-network &>/dev/null; then
        docker network rm custom-network
        echo_green "Network custom-network removed successfully."
    else
        echo_yellow "Network custom-network does not exist."
    fi

    echo
    echo
    echo_white "####################################################################"
}
