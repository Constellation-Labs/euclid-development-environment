#!/usr/bin/env bash

function status_containers() {
  if [[ ! -z "$argc_show_all" ]]; then
    docker ps -a --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
  else
    docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
  fi
}
