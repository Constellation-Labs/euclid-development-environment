#!/usr/bin/env bash

cp genesis/genesis.csv genesis.csv
cp global-l0.jar jars/
cp cl-keytool.jar jars/
cp cl-wallet.jar jars/

if [[ ! -d data/incremental_snapshot ]]; then
    echo "Data directory not exists, cannot run rollback..."
    exit 1
fi
cd data/incremental_snapshot
export LAST_SNAPSHOT=$(ls -hatr | grep "[_[:alnum:]]\{64\}" | tail -1)
echo "Last SNAPSHOT: $LAST_SNAPSHOT"
cd ../..
java -jar global-l0.jar run-rollback --ip 172.50.0.5 $LAST_SNAPSHOT
