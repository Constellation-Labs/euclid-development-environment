#!/usr/bin/env bash

function check_if_github_token_is_valid() {
    if curl -s -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user | grep -q "Bad credentials"; then
        echo "Invalid GITHUB_TOKEN"
        exit 1
    fi
}

function checkout_tessellation_version() {
    cd $2/
    echo "Checking version $1"
    if [ ! -z "$(git ls-remote origin $1)" ]; then
        git pull &>/dev/null
        git checkout $1 &>/dev/null
        echo "Valid version"
        cd ../
    else
        echo "Invalid version"
        exit 1
    fi
}

function get_metagraph_id_from_genesis_currency_l0() {
    for ((i = 1; i <= 11; i++)); do
        METAGRAPH_ID=$(docker logs l0-currency-1 -n 1000 2>&1 | grep -o "Address from genesis data is .*" | grep -o "DAG.*")
        if [[ -z "$METAGRAPH_ID" ]]; then
            if [ $i -eq 10 ]; then
                echo "Could not find the METAGRAPH_ID, check the currency L0 node 1 logs"
                exit 1
            fi
            echo "METAGRAPH_ID not found trying again in 30s"
            sleep 30
        else
            cd ../../../
            echo "METAGRAPH_ID found: $METAGRAPH_ID"
            echo "Filling the hydra.cfg file"
            echo "$(sed '/METAGRAPH_ID=.*/d' hydra.cfg)" > hydra.cfg
            echo "METAGRAPH_ID=$METAGRAPH_ID" >> hydra.cfg
            
            set -o allexport
            source hydra.cfg set
            
            cd infra/docker/metagraph-l0-genesis
            break
        fi
    done
}

function check_p12_files() {
    echo "All 3 P12 files should be inserted on source/p12-files directory"
    if [ ! -f "../source/p12-files/$P12_GENESIS_FILE_NAME" ]; then
        echo "File does not exists"
        exit 1
    fi
    
    if [ ! -f "../source/p12-files/$P12_NODE_2_FILE_NAME" ]; then
        echo "File does not exists"
        exit 1
    fi
    
    if [ ! -f "../source/p12-files/$P12_NODE_3_FILE_NAME" ]; then
        echo "File does not exists"
        exit 1
    fi
}
