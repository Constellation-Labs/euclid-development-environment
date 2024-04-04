#!/usr/bin/env bash

function try_stop_global_l0() {
    if [[ " ${LAYERS[*]} " =~ "global-l0" ]]; then
        echo_white
        echo_white

        echo_white "################################################################"
        echo_yellow "Stopping global-l0 layer..."
        echo_white ""
        ansible-playbook $INFRA_PATH/ansible/local/playbooks/stop/global-l0/cluster.ansible.yml
        if [ $? -eq 0 ]; then
            echo_green "global-l0 stopped successfully"
        else
            echo_red "Failing when stopping global-l0, take a look at the logs."
            exit 1
        fi
        echo_white "################################################################"
    fi
}

function try_stop_dag_l1() {
    if [[ " ${LAYERS[*]} " =~ "dag-l1" ]]; then
        echo_white
        echo_white

        echo_white "################################################################"
        echo_yellow "Stopping dag-l1 layer..."
        echo_white ""
        ansible-playbook $INFRA_PATH/ansible/local/playbooks/stop/dag-l1/cluster.ansible.yml
        if [ $? -eq 0 ]; then
            echo_green "dag-l1 stopped successfully"
        else
            echo_red "Failing when stopping dag-l1, take a look at the logs."
            exit 1
        fi
        echo_white "################################################################"
    fi
}

function try_stop_metagraph_l0() {
    if [[ " ${LAYERS[*]} " =~ "metagraph-l0" ]]; then
        echo_white
        echo_white

        echo_white "################################################################"
        echo_yellow "Stopping metagraph l0 layer..."
        echo_white ""
        ansible-playbook $INFRA_PATH/ansible/local/playbooks/stop/metagraph-l0/cluster.ansible.yml
        if [ $? -eq 0 ]; then
            echo_green "metagraph-l0 stopped successfully"
        else
            echo_red "Failing when stopped metagraph-l0, take a look at the logs."
            exit 1
        fi
        echo_white "################################################################"
    fi
}

function try_stop_currency_l1() {
    if [[ " ${LAYERS[*]} " =~ "currency-l1" ]] || [[ " ${LAYERS[*]} " =~ "metagraph-l1-currency" ]]; then
        echo_white
        echo_white

        echo_white "################################################################"
        echo_yellow "Stopping currency l1 layer..."
        echo_white ""
        ansible-playbook $INFRA_PATH/ansible/local/playbooks/stop/currency-l1/cluster.ansible.yml
        if [ $? -eq 0 ]; then
            echo_green "currency-l1 stopped successfully"
        else
            echo_red "Failing when stopping currency-l1, take a look at the logs."
            exit 1
        fi
        echo_white "################################################################"
    fi
}

function try_stop_data_l1() {
    if [[ " ${LAYERS[*]} " =~ "data-l1" ]] || [[ " ${LAYERS[*]} " =~ "metagraph-l1-data" ]]; then
        echo_white
        echo_white
        echo_white "################################################################"
        echo_yellow "Stopping data l1 layer..."
        echo_white ""
        ansible-playbook $INFRA_PATH/ansible/local/playbooks/stop/data-l1/cluster.ansible.yml
        if [ $? -eq 0 ]; then
            echo_green "data-l1 stopped successfully"
        else
            echo_red "Failing when stopping data-l1, take a look at the logs."
            exit 1
        fi
        echo_white "################################################################"
    fi
}

function try_stop_monitoring() {
    if [ "$START_MONITORING_CONTAINER" = "true" ]; then
        echo_white
        echo_white
        echo_white "################################################################"
        echo_yellow "Stopping monitoring container"
        echo_white ""
        ansible-playbook $INFRA_PATH/ansible/local/playbooks/stop/containers/monitor.ansible.yml

        if [ $? -eq 0 ]; then
            echo_green "Monitor container stopped successfully."
        else
            echo_red "Failing when stopping monitor container, take a look at the logs."
            exit 1
        fi
        echo_white "################################################################"
    fi
}

function stop_containers() {
    echo_white "################################## STOP ##################################"
    check_ansible
    export ANSIBLE_LOCALHOST_WARNING=False
    export ANSIBLE_INVENTORY_UNPARSED_WARNING=False

    try_stop_global_l0
    try_stop_dag_l1
    try_stop_metagraph_l0
    try_stop_currency_l1
    try_stop_data_l1
    try_stop_monitoring

    echo_white "####################################################################"
}
