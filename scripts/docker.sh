#!/usr/bin/env bash

function set_docker_compose() {
    if [ -x "$(command -v docker)" ] && [ "$(docker --version | awk '{print $3}' | cut -d'-' -f1 | cut -d'.' -f1)" -ge "20" ]; then
        # Version 2 syntax
        dockercompose="docker compose"
        elif [ -x "$(command -v docker-compose)" ]; then
        # Version 1 syntax
        dockercompose="docker-compose"
        echo ""
        echo "You only have the older docker compose installed. It should work fine for now."
        echo "The older syntax will be used... $dockercompose"
        echo ""
        echo "It is recommended that you install the latest version of docker compose for better compatibility in future hydra builds:"
        echo "  https://docs.docker.com/compose/install/linux/"
        echo ""
    else
        echo "Docker Compose not found"
        echo "To proceed, you need to make sure it is installed:"
        echo "  https://docs.docker.com/compose/install/linux/"
        exit 1
    fi
}

function check_if_docker_is_running() {
    if ! docker info &>/dev/null; then
        echo "You need to execute Docker service first to run the script."
        exit
    fi
}

function create_docker_custom_network() {
    echo
    echo "Creating docker custom-network..."
    if ! docker network inspect custom-network &>/dev/null; then
        docker network create --driver=bridge --subnet=172.50.0.0/24 custom-network
    fi
    echo "Network created"
}

function run_container() {
    cd $1
    echo "Starting $1 image ..."
    $dockercompose up -d --no-recreate
    echo "$1 image started"
    
    if [[ ! -z "$2" ]]; then
        for ((i = 1; i <= 11; i++)); do
            if ! curl $2 &>/dev/null; then
                if [ $i -eq 10 ]; then
                    echo "Could not find the $1 instance, make sure to run the $1 container"
                    exit 1
                fi
                echo "$1 still booting... waiting 30s ($i/10)"
                sleep 30
            fi
        done
    fi
}

function destroy_container() {
    echo "Destroying $1 container"
    cd infra/docker/$1
    $dockercompose down --remove-orphans
    cd ../../../
    echo "$1 container destroyed"
}

function check_if_images_are_built(){
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "global-l0" ]]; then
        if ! docker inspect --type=image global-l0 &>/dev/null; then
            echo "You need to build the Global L0 first"
            exit 1
        fi
    fi
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l0" ]]; then
        if ! docker inspect --type=image metagraph-l0-initial-validator &>/dev/null; then
            echo "You need to build the Currency L0 first"
            exit 1
        fi
    fi
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-currency" ]]; then
        if ! docker inspect --type=image metagraph-l1-currency-initial-validator &>/dev/null; then
            echo "You need to build the Currency L1 first"
            exit 1
        fi
    fi
    
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "dag-l1" ]]; then
        if ! docker inspect --type=image dag-l1-initial-validator &>/dev/null; then
            echo "You need to build the DAG L1 first"
            exit 1
        fi
    fi
}

function start_containers(){
    check_if_images_are_built
    
    global_l0_url=""
    dag_l1_1_url=""
    dag_l1_2_url=""
    dag_l1_3_url=""
    currency_l0_1_url=""
    currency_l0_2_url=""
    currency_l0_3_url=""
    currency_l1_1_url=""
    currency_l1_2_url=""
    currency_l1_3_url=""
    data_l1_1_url=""
    data_l1_2_url=""
    data_l1_3_url=""
    grafana_url=""
    
    create_docker_custom_network
    
    cd ../infra/docker

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "global-l0" ]]; then
        run_container global-l0 http://localhost:9000/metrics
        global_l0_url="$OUTPUT_YELLOW Global L0: $OUTPUT_WHITE http://localhost:9000/cluster/info"
        cd ../
    fi
    
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "dag-l1" ]]; then
        run_container dag-l1 http://localhost:9100/metrics
        join_l1_global_nodes
        
        dag_l1_1_url="$OUTPUT_YELLOW DAG L1 - 1: $OUTPUT_WHITE http://localhost:9100/cluster/info"
        dag_l1_2_url="$OUTPUT_YELLOW DAG L1 - 2: $OUTPUT_WHITE http://localhost:9200/cluster/info"
        dag_l1_3_url="$OUTPUT_YELLOW DAG L1 - 3: $OUTPUT_WHITE http://localhost:9300/cluster/info"
        cd ../
    fi
    
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l0" ]]; then
        run_container metagraph-l0-genesis http://localhost:9400/metrics
        get_metagraph_id_from_genesis_currency_l0
        cd ../
        
        run_container metagraph-l0 http://localhost:9500/metrics
        join_l0_currency_nodes
        
        currency_l0_1_url="$OUTPUT_YELLOW Currency L0 - 1: $OUTPUT_WHITE http://localhost:9400/cluster/info"
        currency_l0_2_url="$OUTPUT_YELLOW Currency L0 - 2: $OUTPUT_WHITE http://localhost:9500/cluster/info"
        currency_l0_3_url="$OUTPUT_YELLOW Currency L0 - 3: $OUTPUT_WHITE http://localhost:9600/cluster/info"
        cd ../
    fi
    
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-currency" ]]; then
        if [[ -z "$METAGRAPH_ID" ]]; then
            echo "metagraph_id not found on euclid.json file, please fill this parameter or run metagraph-l0"
            exit 1
        fi
        run_container metagraph-l1-currency
        join_l1_currency_nodes
        
        currency_l1_1_url="$OUTPUT_YELLOW Currency L1 - 1: $OUTPUT_WHITE http://localhost:9700/cluster/info"
        currency_l1_2_url="$OUTPUT_YELLOW Currency L1 - 2: $OUTPUT_WHITE http://localhost:9800/cluster/info"
        currency_l1_3_url="$OUTPUT_YELLOW Currency L1 - 3: $OUTPUT_WHITE http://localhost:9900/cluster/info"
        cd ../
    fi

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-data" ]]; then
        if [[ -z "$METAGRAPH_ID" ]]; then
            echo "metagraph_id not found on euclid.json file, please fill this parameter or run metagraph-l0"
            exit 1
        fi
        run_container metagraph-l1-data
        join_l1_data_nodes
        
        data_l1_1_url="$OUTPUT_YELLOW Data L1 - 1: $OUTPUT_WHITE http://localhost:8000/cluster/info"
        data_l1_2_url="$OUTPUT_YELLOW Data L1 - 2: $OUTPUT_WHITE http://localhost:8100/cluster/info"
        data_l1_3_url="$OUTPUT_YELLOW Data L1 - 3: $OUTPUT_WHITE http://localhost:8200/cluster/info"
        cd ../
    fi
    
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "monitoring" ]]; then
        run_container monitoring
        
        grafana_url="$OUTPUT_YELLOW Grafana: $OUTPUT_WHITE http://localhost:3000/"
    fi
    
    echo
    echo
    echo "Containers successfully built."
    echo "Urls:"
    echo
    if [[ ! -z "$global_l0_url" ]]; then
        echo "$global_l0_url"
    fi
    if [[ ! -z "$dag_l1_1_url" ]]; then
        echo "$dag_l1_1_url"
        echo "$dag_l1_2_url"
        echo "$dag_l1_3_url"
    fi
    if [[ ! -z "$currency_l0_1_url" ]]; then
        echo "$currency_l0_1_url"
        echo "$currency_l0_2_url"
        echo "$currency_l0_3_url"
    fi
    if [[ ! -z "$currency_l1_1_url" ]]; then
        echo "$currency_l1_1_url"
        echo "$currency_l1_2_url"
        echo "$currency_l1_3_url"
    fi
    if [[ ! -z "$data_l1_1_url" ]]; then
        echo "$data_l1_1_url"
        echo "$data_l1_2_url"
        echo "$data_l1_3_url"
    fi
    if [[ ! -z "$grafana_url" ]]; then
        echo "$grafana_url"
    fi
}

function stop_container() {
    echo "Stopping $1 container"
    cd infra/docker/$1
    $dockercompose stop
    cd ../../../
    echo "$1 container stopped"
}