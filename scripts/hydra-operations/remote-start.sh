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

  # Validate owner parameters
  if [ "$force_owner_message" = "true" ]; then
    if [ -z "$SNAPSHOT_FEES_OWNER_FILE_NAME" ] || [ -z "$SNAPSHOT_FEES_OWNER_ALIAS" ] || [ -z "$SNAPSHOT_FEES_OWNER_PASSWORD" ]; then
      echo "Error: When force_owner_message is set, you must provide owner_p12_file_name, owner_p12_alias, and owner_p12_password."
      exit 1
    fi
  fi

  # Validate staking parameters
  if [ "$force_staking_message" = "true" ]; then
    if [ -z "$SNAPSHOT_FEES_STAKING_FILE_NAME" ] || [ -z "$SNAPSHOT_FEES_STAKING_ALIAS" ] || [ -z "$SNAPSHOT_FEES_STAKING_PASSWORD" ]; then
      echo "Error: When force_staking_message is set, you must provide staking_p12_file_name, staking_p12_alias, and staking_p12_password."
      exit 1
    fi
  fi


  ansible-playbook \
    -e "force_genesis=$force_genesis" \
    -e "force_owner_message=$force_owner_message" \
    -e "force_staking_message=$force_staking_message" \
    -e "owner_p12_file_name=$SNAPSHOT_FEES_OWNER_FILE_NAME" \
    -e "owner_p12_alias=$SNAPSHOT_FEES_OWNER_ALIAS" \
    -e "owner_p12_password=$SNAPSHOT_FEES_OWNER_PASSWORD" \
    -e "staking_p12_file_name=$SNAPSHOT_FEES_STAKING_FILE_NAME" \
    -e "staking_p12_alias=$SNAPSHOT_FEES_STAKING_ALIAS" \
    -e "staking_p12_password=$SNAPSHOT_FEES_STAKING_PASSWORD" \
    -i $ANSIBLE_HOSTS_FILE $ANSIBLE_NODES_START_PLAYBOOK_FILE
}
