#!/usr/bin/env bash
export CL_GLOBAL_L0_PEER_ID=$(java -jar cl-wallet.jar show-id)

cp genesis/genesis.csv genesis.csv
cp metagraph-l0.jar jars/metagraph-l0.jar

function run_genesis() {
    java -jar metagraph-l0.jar create-genesis genesis.csv
    # Check the exit status
    if [ $? -eq 0 ]; then
        echo "Successfully created metagraphId, running genesis"
        cp genesis.address genesis/
        cp genesis.snapshot genesis/
        java -jar metagraph-l0.jar run-genesis genesis.snapshot --ip 172.50.0.20
    else
        echo "Failing when starting genesis: $?"
    fi
}

rm -r data 2>/dev/null
run_genesis
