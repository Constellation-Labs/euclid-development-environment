#!/usr/bin/env bash

function check_if_config_json_is_valid() {
  PROJECT_NAME=$(jq -r '.project_name // empty' "$ROOT_PATH/euclid.json")
  local json_file="$SOURCE_PATH/metagraph-monitoring-service/config/config.json"
  local fields=(
    ".metagraph.id"
    ".metagraph.name"
    ".metagraph.version"
    ".network.name"
    ".metagraph.nodes[0].ip"
    ".metagraph.nodes[0].username"
    ".metagraph.nodes[0].privateKeyPath"
    ".metagraph.nodes[1].ip"
    ".metagraph.nodes[1].username"
    ".metagraph.nodes[1].privateKeyPath"
    ".metagraph.nodes[2].ip"
    ".metagraph.nodes[2].username"
    ".metagraph.nodes[2].privateKeyPath"
    ".network.nodes[0].ip"
    ".network.nodes[0].port"
    ".network.nodes[0].id"
    ".network.nodes[1].ip"
    ".network.nodes[1].port"
    ".network.nodes[1].id"
    ".network.nodes[2].ip"
    ".network.nodes[2].port"
    ".network.nodes[2].id"
  )
  local empty_fields=()

  for field in "${fields[@]}"; do
    local result=$(jq "if $field == null or $field == \"\" then empty else 1 end" "$json_file")
    if [[ -z $result ]]; then
      empty_fields+=("$field")
    fi
  done

  if [[ ${#empty_fields[@]} -gt 0 ]]; then
    echo_red "Error: The following fields are empty and required in json file: ${json_file}:"
    for field in "${empty_fields[@]}"; do
      echo_red "  - $field"
    done
    exit 1
  else
    echo_green "All required fields are present."
  fi
}

function check_private_key_paths() {
  PROJECT_NAME=$(jq -r '.project_name // empty' "$ROOT_PATH/euclid.json")
  local json_file="$SOURCE_PATH/metagraph-monitoring-service/config/config.json"
  local paths=$(jq -r '.metagraph.nodes[].privateKeyPath' "$json_file")

  local missing_paths=0
  for path in $paths; do
    if [ ! -f "$SOURCE_PATH/metagraph-monitoring-service/$path" ]; then
      echo_red "Error: The file at '$SOURCE_PATH/metagraph-monitoring-service/$path' does not exist."
      ((missing_paths++))
    fi
  done

  if [ $missing_paths -ne 0 ]; then
    echo_red "There were $missing_paths missing privateKeyPath files."
    exit 1
  else
    echo_green "All privateKeyPath files exist."
  fi
}

function remote_deploy_monitoring_service() {
  echo_title "################################## REMOTE DEPLOY ##################################"
  check_ansible
  check_monitoring_host_file

  check_if_config_json_is_valid
  check_private_key_paths

  echo_yellow "Deploying monitoring service on remote host..."
  echo_white ""

  export ANSIBLE_DEPRECATION_WARNINGS=False

  ansible-playbook -i $ANSIBLE_HOSTS_FILE $ANSIBLE_MONITORING_DEPLOY_PLAYBOOK_FILE
  
}
