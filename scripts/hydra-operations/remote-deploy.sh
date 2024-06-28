#!/usr/bin/env bash

function remote_deploy_metagraph() {
  echo_title "################################## REMOTE DEPLOY ##################################"
  check_ansible
  check_nodes_host_file

  echo_yellow "Deploying on remote hosts"
  echo_white ""
  if [[ " ${LAYERS[*]} " =~ "currency-l1" ]] || [[ " ${LAYERS[*]} " =~ "metagraph-l1-currency" ]]; then
    deploy_cl1=true
  else
    deploy_cl1=false
  fi

  if [[ " ${LAYERS[*]} " =~ "data-l1" ]] || [[ " ${LAYERS[*]} " =~ "metagraph-l1-data" ]]; then
    deploy_dl1=true
  else
    deploy_dl1=false
  fi

  if [ ! -z "$argc_force_genesis" ]; then
    force_genesis=true
  else
    force_genesis=false
  fi

  ansible-playbook \
    -e "force_genesis=$force_genesis" \
    -e "deploy_cl1=$deploy_cl1" \
    -e "deploy_dl1=$deploy_dl1" \
    -e "owner_p12_file_name=$SNAPSHOT_FEES_OWNER_FILE_NAME" \
    -e "staking_p12_file_name=$SNAPSHOT_FEES_STAKING_FILE_NAME" \
    -i $ANSIBLE_HOSTS_FILE $ANSIBLE_NODES_DEPLOY_PLAYBOOK_FILE

}
