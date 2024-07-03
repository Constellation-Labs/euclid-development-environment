#!/usr/bin/env bash

function fetch_latest_global_snapshot_metagraph_messages() {
  local metagraph_id=$1
  URL="http://$DEPLOY_NETWORK_HOST_IP:$DEPLOY_NETWORK_HOST_PUBLIC_PORT/global-snapshots/latest/combined" # Replace with your actual URL
  HEADER="Content-Type: application/json"

  echo_title "Fetching latest global snapshot from $URL"
  response=$(curl -s -H "$HEADER" "$URL")
  http_code=$(curl -s -o /dev/null -w "%{http_code}" -H "$HEADER" "$URL")

  if [ "$http_code" -ne 200 ]; then
    echo_red "Failed to fetch data. HTTP Status Code: $http_code"
    exit 1
  else
    last_messages=$(echo "$response" | jq -r ".[1].lastCurrencySnapshots.\"$metagraph_id\".Right[1].lastMessages")

    if [ -z "$last_messages" ] || [ "$last_messages" = "null" ]; then
      echo_red "Failed when extracting the fee configuration from global snapshot. Be sure your metagraph have the fees messages configured"
      exit 1
    else
      echo_green "Last messages extracted successfully:"

      owner_address=$(echo "$last_messages" | jq -r .Owner.value.address)
      owner_parent_ordinal=$(echo "$last_messages" | jq -r .Owner.value.parentOrdinal)
      staking_address=$(echo "$last_messages" | jq -r .Staking.value.address)
      staking_parent_ordinal=$(echo "$last_messages" | jq -r .Staking.value.parentOrdinal)

      # Check if fields are empty or null and handle accordingly
      if [ -z "$owner_address" ] || [ "$owner_address" = "null" ]; then
        owner_address="N/A"
      fi
      if [ -z "$owner_parent_ordinal" ] || [ "$owner_parent_ordinal" = "null" ]; then
        owner_parent_ordinal="N/A"
      fi
      if [ -z "$staking_address" ] || [ "$staking_address" = "null" ]; then
        staking_address="N/A"
      fi
      if [ -z "$staking_parent_ordinal" ] || [ "$staking_parent_ordinal" = "null" ]; then
        staking_parent_ordinal="N/A"
      fi

      echo_white "OWNER"
      echo_url "Owner Address" "$owner_address"
      echo_url "Owner Parent Ordinal" "$owner_parent_ordinal"
      echo
      echo_white "STAKING"
      echo_url "Staking Address" "$staking_address"
      echo_url "Staking Parent Ordinal" "$staking_parent_ordinal"
    fi
  fi

}
function remote_snapshot_fee_config() {
  echo_title "################################## REMOTE SNAPSHOT FEE CONFIG ##################################"
  echo_white

  check_nodes_host_file
  host=$(yq eval ".nodes.hosts.node-1.ansible_host" $ANSIBLE_HOSTS_FILE)
  user=$(yq eval ".nodes.hosts.node-1.ansible_user" $ANSIBLE_HOSTS_FILE)
  private_key=$(yq eval ".nodes.hosts.node-1.ansible_ssh_private_key_file" $ANSIBLE_HOSTS_FILE)

  echo
  echo_title "Fetching the metagraph-id in node $host"
  echo_yellow "SSH to the node..."
  local metagraph_id=$(ssh -i "$private_key" $user@$host "cd code/metagraph-l0; cat genesis.address")

  if [ $? -ne 0 ]; then
    echo_red "SSH command failed. Please check the connection and try again."
    return 1
  else
    echo_green "Metagraph ID: $metagraph_id"
    echo
    fetch_latest_global_snapshot_metagraph_messages $metagraph_id
  fi

}
