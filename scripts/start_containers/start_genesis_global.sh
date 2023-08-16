#!/usr/bin/env bash

cp genesis/genesis.csv genesis.csv
cp global-l0.jar jars/
cp cl-keytool.jar jars/
cp cl-wallet.jar jars/

if [[ $SHOULD_RESET_GENESIS_FILE == true ]]; then
    echo "Removing data directory"
    rm -r data 2> /dev/null
    echo "Running genesis"
    java -jar global-l0.jar run-genesis genesis.csv --ip 172.50.0.5
fi
if [[ $FORCE_ROLLBACK == true ]]; then
    if [[ ! -d data/incremental_snapshot ]]; then
        echo "Data directory not exists, cannot run rollback..."
        exit 1
    fi
    cd data/incremental_snapshot
    export LAST_SNAPSHOT=$( ls -hatr | grep "[_[:alnum:]]\{64\}" | tail -1 )
    echo "Last SNAPSHOT: $LAST_SNAPSHOT"
    cd ../..
    java -jar global-l0.jar run-rollback --ip 172.50.0.5 $LAST_SNAPSHOT
fi
if [[ $SHOULD_RESET_GENESIS_FILE == false && $FORCE_ROLLBACK == false ]]; then
    if [[ -d data/incremental_snapshot ]]; then
        cd data/incremental_snapshot
        export LAST_SNAPSHOT=$( ls -hatr | grep "[_[:alnum:]]\{64\}" | tail -1 )
        echo "Last SNAPSHOT: $$LAST_SNAPSHOT"
        cd ../..
        java -jar global-l0.jar run-rollback --ip 172.50.0.5 $LAST_SNAPSHOT;
    else
        echo "Not found data directory, running genesis"
        java -jar global-l0.jar run-genesis genesis.csv --ip 172.50.0.5
    fi
fi