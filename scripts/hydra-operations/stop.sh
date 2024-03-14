#!/usr/bin/env bash

function stop_container() {
    echo
    echo
    echo_title $2
    echo
    echo_white "Stopping $1 container"
    cd $INFRA_PATH/docker/$1
    $dockercompose stop
    echo_green "$1 container stopped"
}

function stop_containers() {
  echo_white "Stopping containers ..."

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "data-l1" ]] || [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-data" ]]; then
    stop_container data-l1 "DATA-L1"
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "currency-l1" ]] || [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-currency" ]]; then
    stop_container currency-l1 "CURRENCY-L1"
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l0" ]]; then
    stop_container metagraph-l0/genesis "METAGRAPH-L0-GENESIS"

    stop_container metagraph-l0 "METAGRAPH-L0-VALIDATORS"
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "dag-l1" ]]; then
    stop_container dag-l1 "DAG-L1"
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "global-l0" ]]; then
    stop_container global-l0 "GLOBAL-L0"
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "monitoring" ]]; then
    stop_container monitoring "MONITORING"
  fi
}
