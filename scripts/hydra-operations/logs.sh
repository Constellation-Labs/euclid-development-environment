#!/usr/bin/env bash

function logs_containers() {
  echo_title "################################## LOGS ##################################"
  echo_yellow "NOTE: TO STOP LOGGING PRESS CTRL + C"

  echo_white

  local container_name=$argc_container_name
  if [[ ! $(docker ps --format '{{.Names}}' | grep "^$container_name$") ]]; then
    echo_red "Container $container_name is not running."
    exit 1
  fi

  valid_layers=("global-l0" "dag-l1" "metagraph-l0" "currency-l1" "data-l1")
  layer=$argc_layer
  if [[ ! " ${valid_layers[*]} " =~ " $argc_layer " ]]; then
    echo_red "Invalid layer"
    exit 1
  fi

  if [ -z "$argc_n" ]; then
    argc_n=10
  fi

  # Run the command inside the container to check if the directory exists
  docker exec "$container_name" bash -c "[ -d '$layer' ]"
  if [ $? -eq 0 ]; then
    # Run the command inside the container to check if the log file exists
    docker exec "$container_name" bash -c "[ -f '$layer/$layer.log' ]"
    if [ $? -eq 0 ]; then
      docker exec -it $container_name bash -c "cd $layer && tail -f $layer.log -n $argc_n"
    else
      echo_red "Layer $layer does not exists in $container_name"
    fi
  else
    echo_red "Layer $layer does not exists in $container_name"
  fi
}
