export CL_GLOBAL_L0_PEER_ID=$(java -jar cl-wallet.jar show-id)

cp genesis/genesis.csv genesis.csv
cp metagraph-l0.jar jars/metagraph-l0.jar

java -jar metagraph-l0.jar run-rollback --ip 172.50.0.20
