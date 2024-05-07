#!/usr/bin/env bash

function remote_start_monitoring_service() {
  echo_title "################################## REMOTE START MONITORING SERVICE ##################################"
  check_ansible
  check_monitoring_host_file
  add_ssh_key_to_agent monitoring

  echo_yellow "Starting monitoring service on remote host..."
  echo_white ""

  if [ ! -z "$argc_force_restart" ]; then
    force_restart=true
  else
    force_restart=false
  fi

  export ANSIBLE_DEPRECATION_WARNINGS=False

  ansible-playbook -e "force_restart=$force_restart" -i $ANSIBLE_HOSTS_FILE $ANSIBLE_MONITORING_START_PLAYBOOK_FILE
  remove_ssh_key_from_agent monitoring
}
