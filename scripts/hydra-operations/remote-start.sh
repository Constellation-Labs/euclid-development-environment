#!/usr/bin/env bash

function remote_start_metagraph() {
  echo_white "################################## REMOTE START ##################################"
  check_ansible
  check_host_file

  check_network $DEPLOY_NETWORK_NAME

  echo_yellow "Starting on remote hosts"
  echo_white ""
  if [ ! -z "$argc_force_genesis" ]; then
    force_genesis=true
  else
    force_genesis=false
  fi

  ansible-playbook -e "force_genesis=$force_genesis" -i $ANSIBLE_HOSTS_FILE $ANSIBLE_START_PLAYBOOK_FILE
  echo_white "####################################################################"
}
