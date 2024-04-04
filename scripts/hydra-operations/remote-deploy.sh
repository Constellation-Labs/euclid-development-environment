#!/usr/bin/env bash

function remote_deploy_metagraph() {
  echo_white "################################## REMOTE DEPLOY ##################################"
  check_ansible
  check_host_file

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

  if [ ! -z "$argc_deploy_only_metagraph_jars" ]; then
    deploy_only_metagraph_jars=true
  else
    deploy_only_metagraph_jars=false
  fi

  ansible-playbook -e "deploy_only_metagraph_jars=$deploy_only_metagraph_jars" -e "deploy_cl1=$deploy_cl1" -e "deploy_dl1=$deploy_dl1" -i $ANSIBLE_HOSTS_FILE $ANSIBLE_DEPLOY_PLAYBOOK_FILE
  echo_white "####################################################################"
}
