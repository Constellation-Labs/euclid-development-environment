#!/usr/bin/env bash

function remote_logs() {
  echo_title "################################## REMOTE LOGS ##################################"
  echo_white

  valid_hosts=("node-1" "node-2" "node-3" "monitoring")
  host_name=$argc_host_name
  if [[ ! " ${valid_hosts[*]} " =~ " $host_name " ]]; then
    echo_red "Invalid host"
    exit 1
  fi

  valid_layers=("metagraph-l0" "currency-l1" "data-l1" "monitoring")
  layer=$argc_layer
  if [[ ! " ${valid_layers[*]} " =~ " $layer " ]]; then
    echo_red "Invalid layer"
    exit 1
  fi

  if [ -z "$argc_n" ]; then
    argc_n=10
  fi

  if [[ "${host_name}" == "monitoring" ]]; then
    check_monitoring_host_file
    host=$(yq eval '.monitoring.hosts.monitoring-1.ansible_host' $ANSIBLE_HOSTS_FILE)
    user=$(yq eval '.monitoring.hosts.monitoring-1.ansible_user' $ANSIBLE_HOSTS_FILE)
    private_key=$(yq eval '.monitoring.hosts.monitoring-1.ansible_ssh_private_key_file' $ANSIBLE_HOSTS_FILE)

    echo_yellow "NOTE: TO STOP LOGGING PRESS CTRL + C"
    echo_white
    echo "SSH to the node..."
    ssh -i "$private_key" $user@$host "echo 'Node connected'; cd code/dor-metagraph-integrationnet-monitoring-service/logs; latest_file=\$(ls -t application-* 2>/dev/null | head -n 1); if [[ -n \$latest_file ]]; then tail -f \"\$latest_file\" -n $argc_n; else echo 'No application log file found'; fi"

  else
    check_nodes_host_file
    host=$(yq eval ".nodes.hosts.$host_name.ansible_host" $ANSIBLE_HOSTS_FILE)
    user=$(yq eval ".nodes.hosts.$host_name.ansible_user" $ANSIBLE_HOSTS_FILE)
    private_key=$(yq eval ".nodes.hosts.$host_name.ansible_ssh_private_key_file" $ANSIBLE_HOSTS_FILE)

    echo_yellow "NOTE: TO STOP LOGGING PRESS CTRL + C"
    echo_white
    echo "SSH to the node..."
    ssh -i "$private_key" $user@$host "echo 'Node connected'; cd code/$layer && if [ -f logs/app.log ]; then tail -f logs/app.log -n $argc_n; else echo 'Log file not found'; fi"

  fi
}
