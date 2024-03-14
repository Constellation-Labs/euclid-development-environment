#!/usr/bin/env bash

function destroy_images() {
  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "data-l1" ]] || [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-data" ]]; then
    docker rmi data-l1-initial-validator
    docker rmi data-l1-validator-node-2
    docker rmi data-l1-validator-node-3
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "currency-l1" ]] || [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-currency" ]]; then
    docker rmi currency-l1-initial-validator
    docker rmi currency-l1-validator-node-2
    docker rmi currency-l1-validator-node-3
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l0" ]]; then
    docker rmi metagraph-l0-initial-validator
    docker rmi metagraph-l0-validator-node-2
    docker rmi metagraph-l0-validator-node-3
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "dag-l1" ]]; then
    docker rmi dag-l1-initial-validator
    docker rmi dag-l1-validator-node-2
    docker rmi dag-l1-validator-node-3
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "global-l0" ]]; then
    docker rmi global-l0
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "monitoring" ]]; then
    docker rmi grafana/grafana-oss
    docker rmi prom/prometheus
  fi

  docker rmi $(docker images -q "metagraph-base-image-*")
}

function purge_containers() {
  echo_white "Starting purging containers ..."
  destroy_containers
  destroy_images
}
