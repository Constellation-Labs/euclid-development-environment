#!/usr/bin/env bash

function set_docker_compose() {
    if [ -x "$(command -v docker)" ] && [ "$(docker --version | awk '{print $3}' | cut -d'-' -f1 | cut -d'.' -f1)" -ge "20" ]; then
        # Version 2 syntax
        dockercompose="docker compose"
        elif [ -x "$(command -v docker-compose)" ]; then
        # Version 1 syntax
        dockercompose="docker-compose"
        echo_white ""
        echo_white "You only have the older docker compose installed. It should work fine for now."
        echo_white "The older syntax will be used... $dockercompose"
        echo_white ""
        echo_white "It is recommended that you install the latest version of docker compose for better compatibility in future hydra builds:"
        echo_white "  https://docs.docker.com/compose/install/linux/"
        echo_white ""
    else
        echo_red "Docker Compose not found"
        echo_red "To proceed, you need to make sure it is installed:"
        echo_white "  https://docs.docker.com/compose/install/linux/"
        exit 1
    fi
}

function check_if_docker_is_running() {
    if ! docker info &>/dev/null; then
        echo_red "You need to execute Docker service first to run the script."
        exit 1
    fi
}

function create_docker_custom_network() {
    echo_white
    echo_white "Creating docker custom-network..."
    if ! docker network inspect custom-network &>/dev/null; then
        docker network create --driver=bridge --subnet=172.50.0.0/24 custom-network
    fi
    echo_green "Network created"
}

function run_container() {
    echo
    echo_title $3
    echo
    echo

    cd $1
    echo_white "Starting $1 image ..."
    $dockercompose up -d --no-recreate
    
    if [[ ! -z "$2" ]]; then
        for ((i = 1; i <= 11; i++)); do
            if ! curl $2 &>/dev/null; then
                if [ $i -eq 10 ]; then
                    echo_red "Could not find the $1 instance, make sure to run the $1 container"
                    exit 1
                fi
                echo_yellow "$1 still booting... waiting 30s ($i/10)"
                sleep 30
            else
                echo_green "$1 image started"
                return
            fi
        done
    else
        echo_green "$1 image started"
    fi
    
}

function destroy_container() {
    echo
    echo
    echo_title $2
    echo
    echo_white "Destroying $1 container"
    cd infra/docker/$1
    $dockercompose down --remove-orphans
    cd ../../../
    echo_green "$1 container destroyed"
}

function check_if_images_are_built(){
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "global-l0" ]]; then
        if ! docker inspect --type=image global-l0 &>/dev/null; then
            echo_red "You need to build the Global L0 first"
            exit 1
        fi
    fi
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l0" ]]; then
        if ! docker inspect --type=image metagraph-l0-initial-validator &>/dev/null; then
            echo_red "You need to build the Currency L0 first"
            exit 1
        fi
    fi
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-currency" ]]; then
        if ! docker inspect --type=image metagraph-l1-currency-initial-validator &>/dev/null; then
            echo_red "You need to build the Currency L1 first"
            exit 1
        fi
    fi
    
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "dag-l1" ]]; then
        if ! docker inspect --type=image dag-l1-initial-validator &>/dev/null; then
            echo_red "You need to build the DAG L1 first"
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
    metagraph_l0_1_url=""
    metagraph_l0_2_url=""
    metagraph_l0_3_url=""
    metagraph_l1_currency_1_url=""
    metagraph_l1_currency_2_url=""
    metagraph_l1_currency_3_url=""
    metagraph_l1_data_1_url=""
    metagraph_l1_data_2_url=""
    metagraph_l1_data_3_url=""
    grafana_url=""
    
    create_docker_custom_network
    
    cd ../infra/docker

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "global-l0" ]]; then
        run_container global-l0 http://localhost:9000/metrics "GLOBAL-L0"
        global_l0_url="http://localhost:9000/cluster/info"
        cd ../
    fi
    
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "dag-l1" ]]; then
        run_container dag-l1 http://localhost:9100/metrics "DAG-L1"
        join_dag_l1_nodes
        
        dag_l1_1_url="http://localhost:9100/cluster/info"
        dag_l1_2_url="http://localhost:9200/cluster/info"
        dag_l1_3_url="http://localhost:9300/cluster/info"
        cd ../
    fi
    
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l0" ]]; then
        run_container metagraph-l0-genesis http://localhost:9400/metrics "METAGRAPH-L0-GENESIS"
        get_metagraph_id_from_metagraph_l0_genesis
        cd ../
        
        run_container metagraph-l0 http://localhost:9500/metrics "METAGRAPH-L0-VALIDATORS"
        join_metagraph_l0_nodes
        
        metagraph_l0_1_url="http://localhost:9400/cluster/info"
        metagraph_l0_2_url="http://localhost:9500/cluster/info"
        metagraph_l0_3_url="http://localhost:9600/cluster/info"
        cd ../
    fi
    
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-currency" ]]; then
        if [[ -z "$METAGRAPH_ID" ]]; then
            echo_red "metagraph_id not found on euclid.json file, please fill this parameter or run metagraph-l0"
            exit 1
        fi
        run_container metagraph-l1-currency "" "METAGRAPH-L1-CURRENCY"
        join_metagraph_l1_currency_nodes
        
        metagraph_l1_currency_1_url="http://localhost:9700/cluster/info"
        metagraph_l1_currency_2_url="http://localhost:9800/cluster/info"
        metagraph_l1_currency_3_url="http://localhost:9900/cluster/info"
        cd ../
    fi

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-data" ]]; then
        if [[ -z "$METAGRAPH_ID" ]]; then
            echo_red "metagraph_id not found on euclid.json file, please fill this parameter or run metagraph-l0"
            exit 1
        fi
        run_container metagraph-l1-data "" "METAGRAPH-L1-DATA"
        join_metagraph_l1_data_nodes
        
        metagraph_l1_data_1_url="http://localhost:8000/cluster/info"
        metagraph_l1_data_2_url="http://localhost:8100/cluster/info"
        metagraph_l1_data_3_url="http://localhost:8200/cluster/info"
        cd ../
    fi
    
    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "monitoring" ]]; then
        run_container monitoring "" "MONITORING"
        
        grafana_url="http://localhost:3000/"
    fi
    
    echo
    echo
    echo_white "Containers successfully built."
    echo_white "Urls:"
    echo
    if [[ ! -z "$global_l0_url" ]]; then
        echo_url "Global L0:" $global_l0_url
    fi
    if [[ ! -z "$dag_l1_1_url" ]]; then
        echo_url "DAG L1 - 1" $dag_l1_1_url
        echo_url "DAG L1 - 2" $dag_l1_2_url
        echo_url "DAG L1 - 3" $dag_l1_3_url
    fi
    if [[ ! -z "$metagraph_l0_1_url" ]]; then
        echo_url "Metagraph L0 - 1:" $metagraph_l0_1_url
        echo_url "Metagraph L0 - 2:" $metagraph_l0_2_url
        echo_url "Metagraph L0 - 3:" $metagraph_l0_3_url
    fi
    if [[ ! -z "$metagraph_l1_currency_1_url" ]]; then
        echo_url "Metagraph L1 Currency - 1:" $metagraph_l1_currency_1_url
        echo_url "Metagraph L1 Currency - 2:" $metagraph_l1_currency_2_url
        echo_url "Metagraph L1 Currency - 3:" $metagraph_l1_currency_3_url
    fi
    if [[ ! -z "$metagraph_l1_data_1_url" ]]; then
        echo_url "Metagraph L1 Data - 1:" $metagraph_l1_data_1_url
        echo_url "Metagraph L1 Data - 2:" $metagraph_l1_data_2_url
        echo_url "Metagraph L1 Data - 3:" $metagraph_l1_data_3_url
    fi
    if [[ ! -z "$grafana_url" ]]; then
        echo_url "Grafana:" $grafana_url
    fi
}

function stop_container() {
    echo
    echo
    echo_title $2
    echo
    echo_white "Stopping $1 container"
    cd infra/docker/$1
    $dockercompose stop
    cd ../../../
    echo_green "$1 container stopped"
}