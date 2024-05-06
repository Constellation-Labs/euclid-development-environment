#!/usr/bin/env bash

function check_if_global_node_are_healthy() {
  echo
  echo_title "CHECKING IF YOUR PROVIDED GLOBAL L0 NODE IS HEALTHY"

  user_node_info_request=$(curl -s http://$DEPLOY_NETWORK_HOST_IP:$DEPLOY_NETWORK_HOST_PUBLIC_PORT/node/info)
  USER_NODE_STATE=$(echo $user_node_info_request | jq -r '.state')
  USER_TESSELLATION_VERSION=$(echo $user_node_info_request | jq -r '.version')

  load_balancer_node_info_request=$(curl -s https://l0-lb-$DEPLOY_NETWORK_NAME.constellationnetwork.io/node/info)
  LOAD_BALANCER_TESSELLATION_VERSION=$(echo $load_balancer_node_info_request | jq -r '.version')

  echo
  echo_title "Your node information"
  echo_url "ID:" $DEPLOY_NETWORK_HOST_ID
  echo_url "IP:" $DEPLOY_NETWORK_HOST_IP
  echo_url "PUBLIC PORT:" $DEPLOY_NETWORK_HOST_PUBLIC_PORT
  echo_url "NODE STATE:" $USER_NODE_STATE
  echo_url "TESSELLATION VERSION:" $USER_TESSELLATION_VERSION
  echo

  echo_title "Network information"
  echo_url "TESSELLATION VERSION:" $LOAD_BALANCER_TESSELLATION_VERSION

  echo
  echo

  if [ "$USER_TESSELLATION_VERSION" != "$LOAD_BALANCER_TESSELLATION_VERSION" ]; then
    echo_red "Your node has a different Tessellation version than the network, please check your node before continuing"
    echo_red "Node: $USER_TESSELLATION_VERSION"
    echo_red "Network: $LOAD_BALANCER_TESSELLATION_VERSION"
    exit 1
  fi

  if [ "$USER_NODE_STATE" != "Ready" ]; then
    echo_red "Your node should be on Ready state, please check your node before continuing"
    exit 1
  fi

  user_global_snapshots_request=$(curl -s -H "Accept: application/json" http://$DEPLOY_NETWORK_HOST_IP:$DEPLOY_NETWORK_HOST_PUBLIC_PORT/global-snapshots/latest)
  USER_LAST_SNAPSHOT_HASH=$(echo $user_global_snapshots_request | jq -r '.value.lastSnapshotHash')
  USER_ORDINAL=$(echo $user_global_snapshots_request | jq -r '.value.ordinal')

  load_balancer_global_snapshots_request=$(curl -s -H "Accept: application/json" https://l0-lb-$DEPLOY_NETWORK_NAME.constellationnetwork.io/global-snapshots/$USER_ORDINAL)
  LOAD_BALANCER_LAST_SNAPSHOT_HASH=$(echo $load_balancer_global_snapshots_request | jq -r '.value.lastSnapshotHash')
  LOAD_BALANCER_ORDINAL=$(echo $load_balancer_global_snapshots_request | jq -r '.value.ordinal')

  echo_title "Your node snapshot information"
  echo_url "ORDINAL" $USER_ORDINAL
  echo_url "LAST SNAPSHOT HASH:" $USER_LAST_SNAPSHOT_HASH
  echo

  echo_title "Network snapshot information"
  echo_url "ORDINAL" $LOAD_BALANCER_ORDINAL
  echo_url "LAST SNAPSHOT HASH:" $LOAD_BALANCER_LAST_SNAPSHOT_HASH
  echo
  echo
  
  if [ "$USER_LAST_SNAPSHOT_HASH" != "$LOAD_BALANCER_LAST_SNAPSHOT_HASH" ]; then
    echo_red "Your node has a different snapshot hash than the network, probably your node has forked. Please restart your node before continuing"
    echo_red "Node: $USER_LAST_SNAPSHOT_HASH"
    echo_red "Network: $LOAD_BALANCER_LAST_SNAPSHOT_HASH"
    exit 1
  fi

  echo_green "YOUR NODE IS HEALTHY"
  echo_white
}

function remote_start_metagraph() {
  echo_title "################################## REMOTE START ##################################"
  check_if_global_node_are_healthy
  check_ansible
  check_nodes_host_file
  add_ssh_key_to_agent nodes

  check_network $DEPLOY_NETWORK_NAME

  echo_yellow "Starting on remote hosts"
  echo_white ""
  if [ ! -z "$argc_force_genesis" ]; then
    force_genesis=true
  else
    force_genesis=false
  fi
exit 0
  ansible-playbook -e "force_genesis=$force_genesis" -i $ANSIBLE_HOSTS_FILE $ANSIBLE_NODES_START_PLAYBOOK_FILE
  remove_ssh_key_from_agent nodes

}
