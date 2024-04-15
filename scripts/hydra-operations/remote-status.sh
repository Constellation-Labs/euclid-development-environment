#!/usr/bin/env bash

function fetch_node_info() {
  output=$(curl -s "$1")

  if [ -z "$output" ]; then
    echo_red "Could not fetch node info"
  else
    state=$(echo "$output" | jq -r '.state')
    host=$(echo "$output" | jq -r '.host')
    public_port=$(echo "$output" | jq -r '.publicPort')
    p2p_port=$(echo "$output" | jq -r '.p2pPort')
    id=$(echo "$output" | jq -r '.id')
    echo_url "State:" $state
    echo_url "Host:" $host
    echo_url "Public port:" $public_port
    echo_url "P2P port:" $p2p_port
    echo_url "Peer id:" $id
  fi
}

function remote_status() {
  echo_title "################################## REMOTE STATUS ##################################"
  check_nodes_host_file
  metagraph_l0_port=$(yq eval '.nodes.vars.base_metagraph_l0_public_port' $ANSIBLE_HOSTS_FILE)
  currency_l1_port=$(yq eval '.nodes.vars.base_currency_l1_public_port' $ANSIBLE_HOSTS_FILE)
  data_l1_port=$(yq eval '.nodes.vars.base_data_l1_public_port' $ANSIBLE_HOSTS_FILE)
  index=1

  echo
  while IFS= read -r node; do
    echo_title "################################## Node $index ##################################"
    ip=$(jq -r '.ansible_host' <<<"$node")
    echo_green "Metagraph L0"
    local url=http://$ip:$metagraph_l0_port/node/info
    echo_url "URL:" "$url"
    fetch_node_info $url
    echo

    echo_green "Currency L1"
    local url=http://$ip:$currency_l1_port/node/info
    echo_url "URL:" "$url"
    fetch_node_info $url
    echo

    echo_green "Data L1"
    local url=http://$ip:$data_l1_port/node/info
    echo_url "URL:" "$url"
    fetch_node_info $url
    echo

    ((index++))
    echo
  done < <(yq eval -o=j $ANSIBLE_HOSTS_FILE | jq -cr '.nodes.hosts[]')

  
}
