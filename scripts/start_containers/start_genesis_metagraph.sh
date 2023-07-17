#!/usr/bin/env bash

export CL_GLOBAL_L0_PEER_ID=$(java -jar cl-wallet.jar show-id)
export CL_L0_TOKEN_IDENTIFIER=$(java -jar cl-wallet.jar show-address)

cp genesis/genesis.csv genesis.csv
cp metagraph-l0.jar jars/metagraph-l0.jar

if [[ $SHOULD_RESET_GENESIS_FILE == true ]]; then \
    echo "Removing data directory"
    rm -r data 2> /dev/null
    echo "Running genesis"
    java -jar metagraph-l0.jar run-genesis genesis.csv --ip 172.50.0.20; 
fi

if [[ $FORCE_ROLLBACK == true ]]; then
    java -jar metagraph-l0.jar run-rollback --ip 172.50.0.20;
fi

if [[ $SHOULD_RESET_GENESIS_FILE == false && $FORCE_ROLLBACK == false ]]; then
    if [[ -d data/ ]]; then
        java -jar metagraph-l0.jar run-rollback --ip 172.50.0.20;
    else
        echo "Not found data directory, running genesis" && \
        java -jar metagraph-l0.jar run-genesis genesis.csv --ip 172.50.0.20;
    fi
fi