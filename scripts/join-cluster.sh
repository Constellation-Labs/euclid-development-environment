#!/usr/bin/env bash

function join_dag_l1_nodes() {
  echo_white "Joining DAG L1 containers to build the cluster ..."
  for ((i = 1; i <= 11; i++)); do
    if curl -v http://localhost:9100/cluster/info &>/dev/null && curl -v http://localhost:9200/metrics &>/dev/null && curl -v http://localhost:9300/metrics &>/dev/null; then
      echo_white "Joining DAG L1 node 2 ..."
      docker exec -it dag-l1-2 bash -c "cd genesis/ && \
                                                            export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                            export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                            export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                            export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                            curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.10\", \"p2pPort\": 9001 }' &> /dev/null"
      echo_green "DAG L1 node 2 joined"

      echo_white "Joining DAG L1 node 3 ..."
      docker exec -it dag-l1-3 bash -c "cd genesis/ && \
                                                 export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                 export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                 export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                 export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                 curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.10\", \"p2pPort\": 9001 }' &> /dev/null"

      echo_white "DAG L1 node 3 joined"
      echo_green "DAG L1 cluster built successfully"
      break
    else
      echo_yellow "DAG L1 validators still booting... waiting 30s ($i/10)"
      sleep 30
    fi
  done
}

function join_metagraph_l0_nodes() {
  echo_white "Joining Metagraph l0 containers to build the cluster ..."
  for ((i = 1; i <= 11; i++)); do
    if curl -v http://localhost:9400/cluster/info &>/dev/null && curl -v http://localhost:9500/metrics &>/dev/null && curl -v http://localhost:9600/metrics &>/dev/null; then
      echo_white "Joining Metagraph L0 node 2 ..."
      docker exec -it metagraph-l0-2 bash -c "cd genesis/ && \
                                                 export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                 export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                 export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                 export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                 curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.20\", \"p2pPort\": 9001 }' &> /dev/null"
      echo_green "Metagraph L0 node 2 joined"

      echo_white "Joining Metagraph L0 node 3 ..."
      docker exec -it metagraph-l0-3 bash -c "cd genesis/ && \
                                                       export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                       export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                       export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                       export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                       curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.20\", \"p2pPort\": 9001 }' &> /dev/null"
      echo_green "Metagraph L0 node 3 joined"

      echo_green "Metagraph L0 cluster built successfully"
      break
    else
      echo_yellow "Metagraph L0 validators still booting... waiting 30s ($i/10)"
      sleep 30
    fi
  done
}

function join_metagraph_l1_currency_nodes() {
  echo_white "Joining Metagraph L1 Currency containers to build the cluster ..."
  for ((i = 1; i <= 11; i++)); do
    if curl -v http://localhost:9700/cluster/info &>/dev/null && curl -v http://localhost:9800/metrics &>/dev/null && curl -v http://localhost:9900/metrics &>/dev/null; then
      echo_white "Joining Metagraph L1 Currency node 2 ..."
      docker exec -it metagraph-l1-currency-2 bash -c "cd genesis/ && \
                                                 export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                 export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                 export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                 export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                 curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.30\", \"p2pPort\": 9001 }' &> /dev/null"
      echo_green "Metagraph L1 Currency node 2 joined"
      echo_white "Joining Metagraph L1 Currency node 3 ..."
      docker exec -it metagraph-l1-currency-3 bash -c "cd genesis/ && \
                                                 export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                 export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                 export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                 export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                 curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.30\", \"p2pPort\": 9001 }' &> /dev/null"

      echo_green "Metagraph L1 Currency node 3 joined"

      echo_green "Metagraph L1 Currency cluster built successfully"
      break
    else
      echo_yellow "Metagraph L1 Currency validators still booting... waiting 30s ($i/10)"
      sleep 30
    fi
  done
}

function join_metagraph_l1_data_nodes() {
  echo_white "Joining Metagraph L1 Data containers to build the cluster ..."
  for ((i = 1; i <= 11; i++)); do
    if curl -v http://localhost:8000/cluster/info &>/dev/null && curl -v http://localhost:8100/metrics &>/dev/null && curl -v http://localhost:8200/metrics &>/dev/null; then
      echo_white "Joining Metagraph L1 Data node 2 ..."
      docker exec -it metagraph-l1-data-2 bash -c "cd genesis/ && \
                                                 export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                 export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                 export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                 export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                 curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.40\", \"p2pPort\": 9001 }' &> /dev/null"
      echo_green "Metagraph L1 Data node 2 joined"

      echo_white "Joining Metagraph L1 Data node 3..."
      docker exec -it metagraph-l1-data-3 bash -c "cd genesis/ && \
                                                 export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                 export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                 export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                 export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                 curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.40\", \"p2pPort\": 9001 }' &> /dev/null"

      echo_green "Metagraph L1 Data node 3 joined"

      echo_green "Metagraph L1 Data cluster built successfully"
      break
    else
      echo_yellow "Metagraph L1 Data validators still booting... waiting 30s ($i/10)"
      sleep 30
    fi
  done
}