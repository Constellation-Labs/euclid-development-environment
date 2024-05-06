#!/usr/bin/env bash

function remote_start_metagraph() {
  echo_title "################################## REMOTE START ##################################"
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

  ansible-playbook -e "force_genesis=$force_genesis" -i $ANSIBLE_HOSTS_FILE $ANSIBLE_NODES_START_PLAYBOOK_FILE
  remove_ssh_key_from_agent nodes
  
}
