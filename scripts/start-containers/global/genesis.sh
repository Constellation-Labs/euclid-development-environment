#!/usr/bin/env bash

cp genesis/genesis.csv genesis.csv
cp global-l0.jar jars/
cp cl-keytool.jar jars/
cp cl-wallet.jar jars/

echo "Removing data directory"
rm -r data 2>/dev/null
echo "Running genesis"
java -jar global-l0.jar run-genesis genesis.csv --ip 172.50.0.5
