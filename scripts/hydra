check_if_docker_is_running(){
    if ! docker info &>/dev/null; then
      echo "You need to execute Docker service first to run the script."
      exit
    fi
}

run_container() {
  cd $1 || exit
  echo "Starting $1 image ..."
  docker-compose up -d
  echo "$1 image started"

  if [[ ! -z "$2" ]]; then
    for ((i = 1; i <= 11; i++)); do
      if ! curl $2 &>/dev/null; then
        if [ $i -eq 10 ]; then
          echo "Could not find the $1 instance, make sure to run the $1 container"
          exit
        fi
        echo "$1 still booting... waiting 10s ($i/10)"
        sleep 10
      fi
    done
  fi
}

copy_codebase_to_source() {
  if [ -d "$1/tessellation" ]; then
    echo "Directory '$1/tessellation 'already exists, skipping..."
  else
    echo "Copying tessellation to source/$1..."
    chmod -R +w ../source/tessellation
    chmod -R +w ../source/$1
    cp -r ../source/tessellation ../source/$1
    echo "Copied"
  fi
}

create_docker_custom_network() {
  echo "\nCreating docker custom-network..."
  if ! docker network inspect custom-network &>/dev/null; then
    docker network create --driver=bridge --subnet=172.50.0.0/24 custom-network
  fi
  echo "Network created"
}

destroy_container() {
  if [ ! -z "$2" ]; then
    echo "Removing the Tessellation codebase at $1..."
    rm -r source/$1/tessellation
    echo "Removed!"
  fi
  echo "Destroying $1 container"
  cd docker/$1 || exit
  docker-compose down --remove-orphans
  cd ../../
  echo "$1 container destroyed"
}

stop_container() {
  echo "Stopping $1 container"
  cd docker/$1 || exit
  docker-compose stop
  cd ../../
  echo "$1 container stopped"
}

join_l1_currency_nodes() {
  echo "Joining currency l1 containers to build the cluster ..."
  for ((i = 1; i <= 11; i++)); do
    if curl -v http://localhost:9200/cluster/info &>/dev/null && curl -v http://localhost:9300/metrics &>/dev/null && curl -v http://localhost:9400/metrics &>/dev/null; then
      echo "Joining node 2 ..."
      docker exec -it l1-currency-2 bash -c "cd genesis/ && \
                                                 export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                 export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                 export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                 export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                 curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.4\", \"p2pPort\": 9001 }' &> /dev/null"
      echo "Joined"
      echo "Joining node 3 ..."
      docker exec -it l1-currency-3 bash -c "cd genesis/ && \
                                                 export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                 export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                 export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                 export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                 curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.4\", \"p2pPort\": 9001 }' &> /dev/null"

      echo "Joined"

      echo "Currency L1 cluster built successfully"
      break
    else
      echo "Currency L1 validators still booting... waiting 30s ($i/10)"
      sleep 30
    fi
  done
}

join_l1_global_nodes() {
  echo "Joining global l1 containers to build the cluster ..."
  for ((i = 1; i <= 11; i++)); do
    if curl -v http://localhost:9500/cluster/info &>/dev/null && curl -v http://localhost:9600/metrics &>/dev/null && curl -v http://localhost:9700/metrics &>/dev/null; then
      echo "Joining node 2 ..."
      docker exec -it l1-global-2 bash -c "cd genesis/ && \
                                                            export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                            export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                            export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                            export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                            curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.9\", \"p2pPort\": 9001 }' &> /dev/null"
      echo "Joined"

      echo "Joining node 3 ..."
      docker exec -it l1-global-3 bash -c "cd genesis/ && \
                                                 export CL_KEYSTORE=\${CL_KEYSTORE_GENESIS} && \
                                                 export CL_KEYALIAS=\${CL_KEYALIAS_GENESIS} && \
                                                 export CL_PASSWORD=\${CL_PASSWORD_GENESIS} && \
                                                 export GENESIS_ID=\$(java -jar cl-wallet.jar show-id) && \
                                                 curl -v -X POST http://localhost:9002/cluster/join -H \"Content-type: application/json\" -d '{ \"id\":\"'\${GENESIS_ID}'\", \"ip\": \"172.50.0.9\", \"p2pPort\": 9001 }' &> /dev/null"

      echo "Joined"
      echo "Global L1 cluster built successfully"
      break
    else
      echo "Global L1 validators still booting... waiting 30s ($i/10)"
      sleep 30
    fi
  done
}

# @cmd Build all the containers
# @flag   --no_cache                 Build docker containers with no cache
# @flag   --run                      Run containers after build
# @flag   --include_global_l1        Includes the global l1 layer to build/run
# @option --only                     Build specific layer. Options: global-l0, global-l1, currency-l0, currency-l1, monitoring
build() {
  check_if_docker_is_running

  BASEDIR=$(dirname "$0")
  VALID_ONLY_OPTIONS="global-l0 global-l1 currency-l0 currency-l1 monitoring"
  cd $BASEDIR

  read -p "Please provide your GITHUB_TOKEN: " github_token

  if [[ -z "$github_token" && "$argc_only" != "monitoring" ]]; then
    echo "You should provide the GITHUB_PERSONAL_TOKEN"
    exit
  else
    if [[ -z "$argc_only" || "$argc_only" != "monitoring" ]]; then
      echo "\nP12 files should be inserted on source/p12_files directory"

      echo "\n\nGenesis P12 File:"
      read -p "File NAME without p12 extension [token-key]: " p12_genesis_file_name
      p12_genesis_file_name="${p12_genesis_file_name:-token-key}.p12"
      if [ ! -f "../source/p12_files/$p12_genesis_file_name" ]; then
        echo "File does not exists"
        exit
      fi
      read -p "File KEY_ALIAS [token-key]: " p12_genesis_file_key_alias
      p12_genesis_file_key_alias=${p12_genesis_file_key_alias:-token-key}
      read -p "File PASSWORD [password]: " p12_genesis_file_password
      p12_genesis_file_password=${p12_genesis_file_password:-password}

      if [[ -z "$argc_only" || "$argc_only" == "global-l1" || "$argc_only" == "currency-l1" || ! -z "$argc_include_global_l1" ]]; then
        echo "\n\nNode 2 P12 File:"
        read -p "File NAME without p12 extension [token-key-1]: " p12_node_2_file_name
        p12_node_2_file_name="${p12_node_2_file_name:-token-key-1}.p12"
        if [ ! -f "../source/p12_files/$p12_node_2_file_name" ]; then
          echo "File does not exists"
          exit
        fi
        read -p "File KEY_ALIAS [token-key-1]: " p12_node_2_file_key_alias
        p12_node_2_file_key_alias=${p12_node_2_file_key_alias:-token-key-1}
        read -p "File PASSWORD [password]: " p12_node_2_file_password
        p12_node_2_file_password=${p12_node_2_file_password:-password}

        echo "\n\nNode 3 P12 File:"
        read -p "File NAME without p12 extension [token-key-2]: " p12_node_3_file_name
        p12_node_3_file_name="${p12_node_3_file_name:-token-key-2}.p12"
        if [ ! -f "../source/p12_files/$p12_node_3_file_name" ]; then
          echo "File does not exists"
          exit
        fi
        read -p "File KEY_ALIAS [token-key-2]: " p12_node_3_file_key_alias
        p12_node_3_file_key_alias=${p12_node_3_file_key_alias:-token-key-2}
        read -p "File PASSWORD [password]: " p12_node_3_file_password
        p12_node_3_file_password=${p12_node_3_file_password:-password}
      fi
    fi

    global_l0_url=""
    global_l1_1_url=""
    global_l1_2_url=""
    global_l1_3_url=""
    currency_l0_url=""
    currency_l1_1_url=""
    currency_l1_2_url=""
    currency_l1_3_url=""
    grafana_url=""

    if [ ! -z "$argc_only" ]; then
      if [[ ! $VALID_ONLY_OPTIONS =~ (^|[[:space:]])$argc_only($|[[:space:]]) ]]; then
        echo "You should provide a valid only option"
        exit
      fi
    fi

    create_docker_custom_network

    cd ../source
    export DOCKER_BUILDKIT=0

    echo "Cloning tessellation repository to local codebase..."
    git clone https://github.com/Constellation-Labs/tessellation.git

    cd ../docker

    echo "Building ubuntu shared image..."
    cd ubuntu-with-java-and-sbt || exit
    docker-compose build
    docker-compose up -d
    cd ../
    echo "Ubuntu image built"

    if [[ -z "$argc_only" || "$argc_only" == "global-l0" ]]; then
      copy_codebase_to_source global-l0

      cd global-l0 || exit
      if [ ! -z "$argc_no_cache" ]; then
        echo "Building Global L0 image... (NO CACHE)"
        docker-compose build --build-arg GIT_PERSONAL_ACCESS_TOKEN=$github_token --build-arg P12_FILE_NAME=$p12_genesis_file_name --build-arg P12_FILE_KEY_ALIAS=$p12_genesis_file_key_alias --build-arg P12_FILE_PASSWORD=$p12_genesis_file_password --no-cache
      else
        echo "Building Global L0 image... (USING CACHE)"
        docker-compose build --build-arg GIT_PERSONAL_ACCESS_TOKEN=$github_token --build-arg P12_FILE_NAME=$p12_genesis_file_name --build-arg P12_FILE_KEY_ALIAS=$p12_genesis_file_key_alias --build-arg P12_FILE_PASSWORD=$p12_genesis_file_password --no-cache
      fi
      echo "Global L0 image built"

      if [ ! -z "$argc_run" ]; then
        cd ../
        run_container global-l0 http://localhost:9000/metrics
        global_l0_url="Global L0: http://localhost:9000/cluster/info"
      fi
      cd ../
    fi

    if [[ ! -z "$argc_include_global_l1" || "$argc_only" == "global-l1" ]]; then
      copy_codebase_to_source global-l1

      cd global-l1 || exit
      if [ ! -z "$argc_no_cache" ]; then
        echo "Building Global L1 image... (NO CACHE)"
        docker-compose build --build-arg GIT_PERSONAL_ACCESS_TOKEN=$github_token --build-arg P12_FILE_NAME_GENESIS=$p12_genesis_file_name --build-arg P12_FILE_NAME_NODE_2=$p12_node_2_file_name --build-arg P12_FILE_NAME_NODE_3=$p12_node_3_file_name --build-arg P12_FILE_KEY_ALIAS_GENESIS=$p12_genesis_file_key_alias --build-arg P12_FILE_KEY_ALIAS_NODE_2=$p12_node_2_file_key_alias --build-arg P12_FILE_KEY_ALIAS_NODE_3=$p12_node_3_file_key_alias --build-arg P12_FILE_PASSWORD_GENESIS=$p12_genesis_file_password --build-arg P12_FILE_PASSWORD_NODE_2=$p12_node_2_file_password --build-arg P12_FILE_PASSWORD_NODE_3=$p12_node_3_file_password --no-cache
      else
        echo "Building Global L1 image... (USING CACHE)"
        docker-compose build --build-arg GIT_PERSONAL_ACCESS_TOKEN=$github_token --build-arg P12_FILE_NAME_GENESIS=$p12_genesis_file_name --build-arg P12_FILE_NAME_NODE_2=$p12_node_2_file_name --build-arg P12_FILE_NAME_NODE_3=$p12_node_3_file_name --build-arg P12_FILE_KEY_ALIAS_GENESIS=$p12_genesis_file_key_alias --build-arg P12_FILE_KEY_ALIAS_NODE_2=$p12_node_2_file_key_alias --build-arg P12_FILE_KEY_ALIAS_NODE_3=$p12_node_3_file_key_alias --build-arg P12_FILE_PASSWORD_GENESIS=$p12_genesis_file_password --build-arg P12_FILE_PASSWORD_NODE_2=$p12_node_2_file_password --build-arg P12_FILE_PASSWORD_NODE_3=$p12_node_3_file_password
      fi
      echo "Global L1 image built"

      if [ ! -z "$argc_run" ]; then
        cd ../
        run_container global-l1

        join_l1_global_nodes
        global_l1_1_url="Global L1 - 1: http://localhost:9500/cluster/info"
        global_l1_2_url="Global L1 - 2: http://localhost:9600/cluster/info"
        global_l1_3_url="Global L1 - 3: http://localhost:9700/cluster/info"
      fi
      cd ../
    fi

    if [[ -z "$argc_only" || "$argc_only" == "currency-l0" ]]; then
      copy_codebase_to_source currency-l0

      cd currency-l0 || exit
      if [ ! -z "$argc_no_cache" ]; then
        echo "Building Currency L0 image... (NO CACHE)"
        docker-compose build --build-arg GIT_PERSONAL_ACCESS_TOKEN=$github_token --build-arg P12_FILE_NAME=$p12_genesis_file_name --build-arg P12_FILE_KEY_ALIAS=$p12_genesis_file_key_alias --build-arg P12_FILE_PASSWORD=$p12_genesis_file_password --no-cache
      else
        echo "Building Currency L0 image... (USING CACHE)"
        docker-compose build --build-arg GIT_PERSONAL_ACCESS_TOKEN=$github_token --build-arg P12_FILE_NAME=$p12_genesis_file_name --build-arg P12_FILE_KEY_ALIAS=$p12_genesis_file_key_alias --build-arg P12_FILE_PASSWORD=$p12_genesis_file_password --no-cache
      fi
      echo "Currency L0 image built"

      if [ ! -z "$argc_run" ]; then
        cd ../
        run_container currency-l0 http://localhost:9100/metrics

        currency_l0_url="Currency L0: http://localhost:9100/cluster/info"
      fi
      cd ../
    fi

    if [[ -z "$argc_only" || "$argc_only" == "currency-l1" ]]; then
      copy_codebase_to_source currency-l1

      cd currency-l1 || exit
      if [ ! -z "$argc_no_cache" ]; then
        echo "Building Currency L1 image... (NO CACHE)"
        docker-compose build --build-arg GIT_PERSONAL_ACCESS_TOKEN=$github_token --build-arg P12_FILE_NAME_GENESIS=$p12_genesis_file_name --build-arg P12_FILE_NAME_NODE_2=$p12_node_2_file_name --build-arg P12_FILE_NAME_NODE_3=$p12_node_3_file_name --build-arg P12_FILE_KEY_ALIAS_GENESIS=$p12_genesis_file_key_alias --build-arg P12_FILE_KEY_ALIAS_NODE_2=$p12_node_2_file_key_alias --build-arg P12_FILE_KEY_ALIAS_NODE_3=$p12_node_3_file_key_alias --build-arg P12_FILE_PASSWORD_GENESIS=$p12_genesis_file_password --build-arg P12_FILE_PASSWORD_NODE_2=$p12_node_2_file_password --build-arg P12_FILE_PASSWORD_NODE_3=$p12_node_3_file_password --no-cache
      else
        echo "Building Currency L1 image... (USING CACHE)"
        docker-compose build --build-arg GIT_PERSONAL_ACCESS_TOKEN=$github_token --build-arg P12_FILE_NAME_GENESIS=$p12_genesis_file_name --build-arg P12_FILE_NAME_NODE_2=$p12_node_2_file_name --build-arg P12_FILE_NAME_NODE_3=$p12_node_3_file_name --build-arg P12_FILE_KEY_ALIAS_GENESIS=$p12_genesis_file_key_alias --build-arg P12_FILE_KEY_ALIAS_NODE_2=$p12_node_2_file_key_alias --build-arg P12_FILE_KEY_ALIAS_NODE_3=$p12_node_3_file_key_alias --build-arg P12_FILE_PASSWORD_GENESIS=$p12_genesis_file_password --build-arg P12_FILE_PASSWORD_NODE_2=$p12_node_2_file_password --build-arg P12_FILE_PASSWORD_NODE_3=$p12_node_3_file_password
      fi
      echo "Currency L1 image built"

      if [ ! -z "$argc_run" ]; then
        cd ../
        run_container currency-l1
        join_l1_currency_nodes

        currency_l1_1_url="Currency L1 - 1: http://localhost:9200/cluster/info"
        currency_l1_2_url="Currency L1 - 2: http://localhost:9300/cluster/info"
        currency_l1_3_url="Currency L1 - 3: http://localhost:9400/cluster/info"
      fi
      cd ../
    fi

    if [[ -z "$argc_only" || "$argc_only" == "monitoring" ]]; then
      cd monitoring || exit
      if [ ! -z "$argc_no_cache" ]; then
        echo "Building monitoring image... (NO CACHE)"
        docker-compose build --no-cache
      else
        echo "Building monitoring image... (USING CACHE)"
        docker-compose build
      fi
      echo "monitoring image built"

      if [ ! -z "$argc_run" ]; then
        cd ../
        run_container monitoring

        grafana_url="Grafana: http://localhost:3000/"
      fi
      cd ../
    fi

    if [ ! -z "$argc_run" ]; then
      echo "Containers successfully built. URLs:"
      echo "$global_l0_url"
      echo "$currency_l0_url"
      echo "$currency_l1_1_url"
      echo "$currency_l1_2_url"
      echo "$currency_l1_3_url"
      echo "$grafana_url"
      echo "$global_l1_1_url"
      echo "$global_l1_2_url"
      echo "$global_l1_3_url"
    fi

    echo "Cleaning up docker images"
    docker rmi $(docker images -f "dangling=true" -q) &>/dev/null

    chmod -R +w ../source
    chmod -R +w ../source/tessellation
    rm -r ../source/tessellation
  fi
}

# @cmd Start all the containers
# @flag   --include_global_l1        Includes the global l1 layer to build/run
# @option --only                     Build specific layer. Options: global-l0, global-l1, currency-l0, currency-l1, monitoring
start() {
  check_if_docker_is_running
  if [[ -z "$argc_only" || "$argc_only" == "global-l0" ]]; then
    if ! docker inspect --type=image global-l0 &>/dev/null; then
      echo "You need to build the Global L0 first"
      exit
    fi
  fi
  if [[ -z "$argc_only" || "$argc_only" == "currency-l0" ]]; then
    if ! docker inspect --type=image currency-l0 &>/dev/null; then
      echo "You need to build the Currency L0 first"
      exit
    fi
  fi
  if [[ -z "$argc_only" || "$argc_only" == "currency-l1" ]]; then
    if ! docker inspect --type=image currency-l1-initial-validator &>/dev/null; then
      echo "You need to build the Currency L1 first"
      exit
    fi
  fi

  if [[ ! -z "$argc_include_global_l1" || "$argc_only" == "global-l1" ]]; then
    if ! docker inspect --type=image global-l1-initial-validator &>/dev/null; then
      echo "You need to build the Global L1 first"
      exit
    fi
  fi

  VALID_ONLY_OPTIONS="global-l0 global-l1 currency-l0 currency-l1 monitoring"
  BASEDIR=$(dirname "$0")
  cd $BASEDIR

  global_l0_url=""
  global_l1_1_url=""
  global_l1_2_url=""
  global_l1_3_url=""
  currency_l0_url=""
  currency_l1_1_url=""
  currency_l1_2_url=""
  currency_l1_3_url=""
  grafana_url=""

  if [ ! -z "$argc_only" ]; then
    if [[ ! $VALID_ONLY_OPTIONS =~ (^|[[:space:]])$argc_only($|[[:space:]]) ]]; then
      echo "You should provide a valid only option"
      exit
    fi
  fi

  create_docker_custom_network

  cd ../docker
  export DOCKER_BUILDKIT=0
  if [[ -z "$argc_only" || "$argc_only" == "global-l0" ]]; then
    run_container global-l0 http://localhost:9000/metrics
    global_l0_url="Global L0: http://localhost:9000/cluster/info"
    cd ../
  fi

  if [[ ! -z "$argc_include_global_l1" || "$argc_only" == "global-l1" ]]; then
    run_container global-l1 http://localhost:9000/metrics
    join_l1_global_nodes

    global_l1_1_url="Global L1 - 1: http://localhost:9500/cluster/info"
    global_l1_2_url="Global L1 - 2: http://localhost:9600/cluster/info"
    global_l1_3_url="Global L1 - 3: http://localhost:9700/cluster/info"
    cd ../
  fi

  if [[ -z "$argc_only" || "$argc_only" == "currency-l0" ]]; then
    run_container currency-l0 http://localhost:9100/metrics
    currency_l0_url="Currency L0: http://localhost:9100/cluster/info"
    cd ../
  fi

  if [[ -z "$argc_only" || "$argc_only" == "currency-l1" ]]; then
    run_container currency-l1
    join_l1_currency_nodes

    currency_l1_1_url="Currency L1 - 1: http://localhost:9200/cluster/info"
    currency_l1_2_url="Currency L1 - 2: http://localhost:9300/cluster/info"
    currency_l1_3_url="Currency L1 - 3: http://localhost:9400/cluster/info"
    cd ../
  fi

  if [[ -z "$argc_only" || "$argc_only" == "monitoring" ]]; then
    run_container monitoring

    grafana_url="Grafana: http://localhost:3000/"
  fi

  echo "Containers successfully built. URLs:"
  echo "$global_l0_url"
  echo "$currency_l0_url"
  echo "$currency_l1_1_url"
  echo "$currency_l1_2_url"
  echo "$currency_l1_3_url"
  echo "$grafana_url"
  echo "$global_l1_1_url"
  echo "$global_l1_2_url"
  echo "$global_l1_3_url"
}

# @cmd Destroy all the containers
# @option --only                     Build specific layer. Options: global-l0, global-l1, currency-l0, currency-l1, monitoring
stop() {
  check_if_docker_is_running
  BASEDIR=$(dirname "$0")
  cd $BASEDIR || exit
  cd ..
  chmod -R +w source

  echo "Starting stopping containers ..."

  if [[ -z "$argc_only" || "$argc_only" == "currency-l1" ]]; then
    stop_container currency-l1
  fi

  if [[ -z "$argc_only" || "$argc_only" == "currency-l0" ]]; then
    stop_container currency-l0
  fi

  if [[ -z "$argc_only" || "$argc_only" == "global-l1" ]]; then
    stop_container global-l1
  fi

  if [[ -z "$argc_only" || "$argc_only" == "global-l0" ]]; then
    stop_container global-l0
  fi

  if [[ -z "$argc_only" || "$argc_only" == "monitoring" ]]; then
    stop_container monitoring
  fi
}

# @cmd Destroy all the containers
# @flag  --delete_local_codebase     Delete all local codebase
# @option --only                     Build specific layer. Options: global-l0, global-l1, currency-l0, currency-l1, monitoring
destroy() {
  check_if_docker_is_running
  BASEDIR=$(dirname "$0")
  cd $BASEDIR || exit
  cd ..
  chmod -R +w source

  echo "Starting destroying containers ..."

  if [[ -z "$argc_only" || "$argc_only" == "currency-l1" ]]; then
    destroy_container currency-l1 $argc_delete_local_codebase
  fi

  if [[ -z "$argc_only" || "$argc_only" == "currency-l0" ]]; then
    destroy_container currency-l0 $argc_delete_local_codebase
  fi

  if [[ -z "$argc_only" || "$argc_only" == "global-l1" ]]; then
    destroy_container global-l1 $argc_delete_local_codebase
  fi

  if [[ -z "$argc_only" || "$argc_only" == "global-l0" ]]; then
    destroy_container global-l0 $argc_delete_local_codebase
  fi

  if [[ -z "$argc_only" || "$argc_only" == "monitoring" ]]; then
    destroy_container monitoring
  fi

  destroy_container ubuntu-with-java-and-sbt

  docker network rm custom-network
  docker rmi $(docker images -f "dangling=true" -q) &>/dev/null

  chmod -R +w source
  chmod -R +w source/tessellation
  rm -r source/tessellation
}

eval "$(argc "$0" "$@")"
