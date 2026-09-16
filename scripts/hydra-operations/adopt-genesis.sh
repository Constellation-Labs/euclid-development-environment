#!/usr/bin/env bash

# Record provenance for genesis files that were generated before provenance existed and are
# already running on deploy.network.name. This lets an existing metagraph keep its ID while
# remote-deploy / remote-start gain the ability to verify the files they ship and start.
function adopt_genesis_provenance() {
    echo_title "################################## ADOPT GENESIS ##################################"
    check_network "$DEPLOY_NETWORK_NAME"

    local genesis_directory="$INFRA_PATH/shared/genesis"
    if [[ ! -f "$genesis_directory/genesis.address" || ! -f "$genesis_directory/genesis.snapshot" ]]; then
        echo_red "infra/shared/genesis must contain genesis.address and genesis.snapshot to adopt."
        exit 1
    fi
    if [[ -f "$genesis_directory/genesis.provenance.json" ]]; then
        echo_yellow "infra/shared/genesis/genesis.provenance.json already exists and will be replaced:"
        cat "$genesis_directory/genesis.provenance.json"
        echo_white ""
    fi

    echo_white "Metagraph ID: $(cat "$genesis_directory/genesis.address")"
    echo_yellow "Only adopt genesis files that are ALREADY RUNNING on $DEPLOY_NETWORK_NAME."
    echo_yellow "A genesis created against any other network (for example with 'hydra start-genesis') can never produce snapshot 2 on $DEPLOY_NETWORK_NAME; regenerate it with 'hydra create-remote-genesis' instead."
    read -p "Record these files as the $DEPLOY_NETWORK_NAME genesis? (Y/y to confirm): " -r response
    echo_white ""
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Aborting"
        exit 1
    fi

    GENESIS_NETWORK=$DEPLOY_NETWORK_NAME record_genesis_provenance || exit 1
    echo_green "Provenance recorded. Run 'hydra remote-deploy' to copy it to hosts whose genesis files match."
}
