#!/usr/bin/env bash

function run_container() {
    echo
    echo_title $3
    echo
    echo

    cd $INFRA_PATH/docker/$1
    echo_white "Starting $1 image ..."
    $dockercompose up -d --no-recreate

    if [[ ! -z "$2" ]]; then
        for ((i = 1; i <= 51; i++)); do
            if ! curl $2 &>/dev/null; then
                if [ $i -eq 50 ]; then
                    echo_red "Could not find the $1 instance, make sure to run the $1 container"
                    exit 1
                fi
                echo_yellow "$1 still booting... waiting 5s ($i/50)"
                sleep 5
            else
                echo_green "$1 image started"
                return
            fi
        done
    else
        echo_green "$1 image started"
    fi

}

function start_containers() {
    local FORCE_ROLLBACK=$1
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

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "global-l0" ]]; then
        if [[ $FORCE_ROLLBACK == true ]]; then
            cp $SCRIPTS_PATH/start-containers/global/rollback.sh $SCRIPTS_PATH/start-containers/global/start.sh
        else
            cp $SCRIPTS_PATH/start-containers/global/genesis.sh $SCRIPTS_PATH/start-containers/global/start.sh
        fi

        run_container global-l0 http://localhost:9000/metrics "GLOBAL-L0"
        global_l0_url="http://localhost:9000/cluster/info"
    fi

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "dag-l1" ]]; then
        run_container dag-l1 http://localhost:9100/metrics "DAG-L1"
        join_dag_l1_nodes

        dag_l1_1_url="http://localhost:9100/cluster/info"
        dag_l1_2_url="http://localhost:9200/cluster/info"
        dag_l1_3_url="http://localhost:9300/cluster/info"
    fi

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l0" ]]; then
        if [[ $FORCE_ROLLBACK == true ]]; then
            {
            echo "#!/usr/bin/env bash"
            echo "export CL_L0_TOKEN_IDENTIFIER=$METAGRAPH_ID"
            } > $SCRIPTS_PATH/start-containers/metagraph/temp_file.sh
            cat $SCRIPTS_PATH/start-containers/metagraph/rollback.sh >> $SCRIPTS_PATH/start-containers/metagraph/temp_file.sh
            mv $SCRIPTS_PATH/start-containers/metagraph/temp_file.sh $SCRIPTS_PATH/start-containers/metagraph/start.sh
        else
            cp $SCRIPTS_PATH/start-containers/metagraph/genesis.sh $SCRIPTS_PATH/start-containers/metagraph/start.sh
        fi

        run_container metagraph-l0/genesis http://localhost:9400/metrics "METAGRAPH-L0-GENESIS"
        
        get_metagraph_id_from_metagraph_l0_genesis

        run_container metagraph-l0 http://localhost:9500/metrics "METAGRAPH-L0-VALIDATORS"
        join_metagraph_l0_nodes

        metagraph_l0_1_url="http://localhost:9400/cluster/info"
        metagraph_l0_2_url="http://localhost:9500/cluster/info"
        metagraph_l0_3_url="http://localhost:9600/cluster/info"
    fi

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "currency-l1" ]] || [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-currency" ]]; then
        if [[ -z "$METAGRAPH_ID" ]]; then
            echo_red "metagraph_id not found on euclid.json file, please fill this parameter or run metagraph-l0"
            exit 1
        fi
        run_container currency-l1 "" "CURRENCY-L1"
        join_metagraph_l1_currency_nodes

        metagraph_l1_currency_1_url="http://localhost:9700/cluster/info"
        metagraph_l1_currency_2_url="http://localhost:9800/cluster/info"
        metagraph_l1_currency_3_url="http://localhost:9900/cluster/info"
    fi

    if [[ " ${DOCKER_CONTAINERS[*]} " =~ "data-l1" ]] || [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-data" ]]; then
        if [[ -z "$METAGRAPH_ID" ]]; then
            echo_red "metagraph_id not found on euclid.json file, please fill this parameter or run metagraph-l0"
            exit 1
        fi
        run_container data-l1 "" "DATA-L1"
        join_metagraph_l1_data_nodes

        metagraph_l1_data_1_url="http://localhost:8000/cluster/info"
        metagraph_l1_data_2_url="http://localhost:8100/cluster/info"
        metagraph_l1_data_3_url="http://localhost:8200/cluster/info"
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