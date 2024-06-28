#!/usr/bin/env bash

function remote_start_metagraph() {
  echo_title "################################## REMOTE START ##################################"
  check_ansible
  check_nodes_host_file

  check_network $DEPLOY_NETWORK_NAME

  echo_yellow "Starting on remote hosts"
  echo_white ""
  if [ ! -z "$argc_force_genesis" ]; then
    force_genesis=true
  else
    force_genesis=false
  fi

  if [ ! -z "$argc_force_owner_message" ]; then
    force_owner_message=true
  else
    force_owner_message=false
  fi

  if [ ! -z "$argc_force_staking_message" ]; then
    force_staking_message=true
  else
    force_staking_message=false
  fi

  if [ -z "$argc_owner_parent_ordinal" ]; then
    owner_parent_ordinal=0
  else
    owner_parent_ordinal=$argc_owner_parent_ordinal
  fi

  if [ -z "$argc_staking_parent_ordinal" ]; then
    staking_parent_ordinal=0
  else
    staking_parent_ordinal=$argc_staking_parent_ordinal
  fi

  # Validate owner parameters
  if [ "$force_owner_message" = "true" ]; then
    if [ -z "$argc_owner_p12_file_name" ] || [ -z "$argc_owner_p12_alias" ] || [ -z "$argc_owner_p12_password" ]; then
      echo "Error: When force_owner_message is set, you must provide owner_p12_file_name, owner_p12_alias, and owner_p12_password."
      exit 1
    fi
  fi

  # Validate staking parameters
  if [ "$force_staking_message" = "true" ]; then
    if [ -z "$argc_staking_p12_file_name" ] || [ -z "$argc_staking_p12_alias" ] || [ -z "$argc_staking_p12_password" ]; then
      echo "Error: When force_staking_message is set, you must provide staking_p12_file_name, staking_p12_alias, and staking_p12_password."
      exit 1
    fi
  fi

  ansible-playbook \
    -e "force_genesis=$force_genesis" \
    -e "owner_p12_file_name=$argc_owner_p12_file_name" \
    -e "owner_p12_alias=$argc_owner_p12_alias" \
    -e "owner_p12_password=$argc_owner_p12_password" \
    -e "owner_parent_ordinal=$argc_owner_p12_password" \
    -e "staking_p12_file_name=$argc_staking_p12_file_name" \
    -e "staking_p12_alias=$argc_staking_p12_alias" \
    -e "staking_p12_password=$argc_staking_p12_password" \
    -e "force_owner_message=$force_owner_message" \
    -e "owner_parent_ordinal=$owner_parent_ordinal" \
    -e "force_staking_message=$force_staking_message" \
    -e "staking_parent_ordinal=$staking_parent_ordinal" \
    -i $ANSIBLE_HOSTS_FILE $ANSIBLE_NODES_START_PLAYBOOK_FILE
}
