#!/usr/bin/env bash

function destroy_images() {
  echo_yellow "Starting to remove the images..."
  echo
  echo_white "Removing image metagraph-base-image"
  docker rmi -f metagraph-base-image &>/dev/null
  echo_green "Removed"

  echo_white "Removing image metagraph-ubuntu-*"
  docker rmi -f $(docker images -q "metagraph-ubuntu-*") &>/dev/null
  echo_green "Removed"

  echo_white "Removing image grafana-oss"
  docker rmi -f grafana/grafana-oss &>/dev/null
  echo_green "Removed"

  echo_white "Removing image prom/prometheus"
  docker rmi -f prom/prometheus &>/dev/null
  echo_green "Removed"

  docker image prune -f
}

function purge_containers() {
  echo_title "################################## PURGE ##################################"
  echo_white "Starting purging containers ..."
  destroy_containers
  destroy_images
  
}
