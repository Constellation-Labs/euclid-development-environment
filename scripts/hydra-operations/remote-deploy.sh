#!/usr/bin/env bash

function remote_deploy_metagraph() {
  check_ansible

  echo_yellow "Deploying on remote hosts"
  echo_white ""
  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "currency-l1" ]] || [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-currency" ]]; then
    deploy_cl1=true
  else
    deploy_cl1=false
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "data-l1" ]] || [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-data" ]]; then
    deploy_dl1=true
  else
    deploy_dl1=false
  fi

  ansible-playbook -e "deploy_cl1=$deploy_cl1" -e "deploy_dl1=$deploy_dl1" -i $ANSIBLE_HOSTS_FILE $ANSIBLE_DEPLOY_PLAYBOOK_FILE
}
