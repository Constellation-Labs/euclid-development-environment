function join_l1_currency_nodes() {
  echo "Joining currency l1 containers to build the cluster ..."
  for ((i = 1; i <= 11; i++)); do
    if curl -v http://localhost:9700/cluster/info &>/dev/null && curl -v http://localhost:9800/metrics &>/dev/null && curl -v http://localhost:9900/metrics &>/dev/null; then
      echo "Joining node 2 ..."
      docker exec -it l1-currency-2 bash -c "cd genesis/ && \
                                                 export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                 export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                 export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                 export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                 curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.30\", \"p2pPort\": 9001 }' &> /dev/null"
      echo "Joined"
      echo "Joining node 3 ..."
      docker exec -it l1-currency-3 bash -c "cd genesis/ && \
                                                 export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                 export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                 export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                 export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                 curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.30\", \"p2pPort\": 9001 }' &> /dev/null"

      echo "Joined"

      echo "Currency L1 cluster built successfully"
      break
    else
      echo "Currency L1 validators still booting... waiting 30s ($i/10)"
      sleep 30
    fi
  done
}

function join_l1_global_nodes() {
  echo "Joining DAG l1 containers to build the cluster ..."
  for ((i = 1; i <= 11; i++)); do
    if curl -v http://localhost:9100/cluster/info &>/dev/null && curl -v http://localhost:9200/metrics &>/dev/null && curl -v http://localhost:9300/metrics &>/dev/null; then
      echo "Joining node 2 ..."
      docker exec -it l1-dag-2 bash -c "cd genesis/ && \
                                                            export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                            export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                            export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                            export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                            curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.10\", \"p2pPort\": 9001 }' &> /dev/null"
      echo "Joined"

      echo "Joining node 3 ..."
      docker exec -it l1-dag-3 bash -c "cd genesis/ && \
                                                 export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                 export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                 export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                 export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                 curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.10\", \"p2pPort\": 9001 }' &> /dev/null"

      echo "Joined"
      echo "DAG L1 cluster built successfully"
      break
    else
      echo "DAG L1 validators still booting... waiting 30s ($i/10)"
      sleep 30
    fi
  done
}

function join_l0_currency_nodes() {
  echo "Joining currency l0 containers to build the cluster ..."
  for ((i = 1; i <= 11; i++)); do
    if curl -v http://localhost:9400/cluster/info &>/dev/null && curl -v http://localhost:9500/metrics &>/dev/null && curl -v http://localhost:9600/metrics &>/dev/null; then
      echo "Joining node 2 ..."
      docker exec -it l0-currency-2 bash -c "cd genesis/ && \
                                                 export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                 export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                 export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                 export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                 curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.20\", \"p2pPort\": 9001 }' &> /dev/null"
      echo "Joined"

      echo "Joining node 3 ..."
      docker exec -it l0-currency-3 bash -c "cd genesis/ && \
                                                       export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                       export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                       export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                       export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                       curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.20\", \"p2pPort\": 9001 }' &> /dev/null"
      echo "Joined"

      echo "Currency L0 cluster built successfully"
      break
    else
      echo "Currency L0 validators still booting... waiting 30s ($i/10)"
      sleep 30
    fi
  done
}

function join_l1_data_nodes() {
  echo "Joining data l1 containers to build the cluster ..."
  for ((i = 1; i <= 11; i++)); do
    if curl -v http://localhost:8000/cluster/info &>/dev/null && curl -v http://localhost:8100/metrics &>/dev/null && curl -v http://localhost:8200/metrics &>/dev/null; then
      echo "Joining node 2 ..."
      docker exec -it l1-data-2 bash -c "cd genesis/ && \
                                                 export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                 export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                 export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                 export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                 curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.40\", \"p2pPort\": 9001 }' &> /dev/null"
      echo "Joined"
      echo "Joining node 3 ..."
      docker exec -it l1-data-3 bash -c "cd genesis/ && \
                                                 export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                 export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                 export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                 export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                 curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.40\", \"p2pPort\": 9001 }' &> /dev/null"

      echo "Joined"

      echo "Data L1 cluster built successfully"
      break
    else
      echo "Data L1 validators still booting... waiting 30s ($i/10)"
      sleep 30
    fi
  done
}