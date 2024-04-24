#!/usr/bin/env bash

function check_docker_health() {
  if ! docker info >/dev/null 2>&1; then
    echo_red "Docker is not running"
    exit 1
  fi

  echo_green "Docker is healthy and running."
}

function check_if_container_is_running() {
  container_name=$1
  if docker ps --filter "name=${container_name}" --filter "status=running" | grep -q ${container_name}; then
    echo_green "Container '${container_name}' is running."
    return 0
  else
    echo_red "Container '${container_name}' is not running or does not exist."
    return 1
  fi
}

function status_containers() {
  echo_title "################################## STATUS ##################################"
  check_docker_health

  ansible_vars_path=$INFRA_PATH/ansible/local/playbooks/vars.ansible.yml
  offset=$(yq eval '.offset' $ansible_vars_path)
  index=0

  echo
  file_path="${INFRA_PATH}/docker/shared/genesis/genesis.address"
  if [ -f "$file_path" ]; then
    echo_url "Metagraph ID:" "$(cat $file_path)"
  else
    echo_yellow "Could not get Metagraph ID, file $file_path does not exists"
  fi

  echo

  while IFS= read -r node; do
    name=$(jq -r '.name' <<<"$node")
    cl_keystore=$(jq -r '.key_file.name' <<<"$node")
    cl_keyalias=$(jq -r '.key_file.alias' <<<"$node")
    cl_password=$(jq -r '.key_file.password' <<<"$node")

    echo_green "Container $name"
    if check_if_container_is_running "${name}"; then
      echo_url "PeerID:" "$(docker exec $name bash -c "cd metagraph-l0 && export CL_KEYSTORE=$cl_keystore && export CL_KEYALIAS=$cl_keyalias && export CL_PASSWORD=$cl_password && java -jar cl-wallet.jar show-id")"
      if [[ $index -eq 0 ]] && [[ " ${LAYERS[*]} " =~ "global-l0" ]]; then
        echo
        echo_green "Global L0"
        raw_port=$(yq eval '.base_global_l0_public_port' $ansible_vars_path)
        local url=http://localhost:$raw_port/node/info
        echo_url "URL:" "$url"
        echo_url "Node info:" "$(curl -s $url)"
      fi

      if [[ " ${LAYERS[*]} " =~ "dag-l1" ]]; then
        echo
        echo_green "DAG L1"
        raw_port=$(yq eval '.base_dag_l1_public_port' $ansible_vars_path)
        port=$(($raw_port + $index * $offset))
        local url=http://localhost:$port/node/info
        echo_url "URL:" "$url"
        echo_url "Node info:" "$(curl -s $url)"
      fi

      if [[ " ${LAYERS[*]} " =~ "metagraph-l0" ]]; then
        echo
        echo_green "Metagraph L0"
        raw_port=$(yq eval '.base_metagraph_l0_public_port' $ansible_vars_path)
        port=$(($raw_port + $index * $offset))
        local url=http://localhost:$port/node/info
        echo_url "URL:" "$url"
        echo_url "Node info:" "$(curl -s $url)"
      fi

      if [[ " ${LAYERS[*]} " =~ "currency-l1" ]] || [[ " ${LAYERS[*]} " =~ "metagraph-l1-currency" ]]; then
        echo
        echo_green "Currency L1"
        raw_port=$(yq eval '.base_currency_l1_public_port' $ansible_vars_path)
        port=$(($raw_port + $index * $offset))
        local url=http://localhost:$port/node/info
        echo_url "URL:" "$url"
        echo_url "Node info:" "$(curl -s $url)"
      fi

      if [[ " ${LAYERS[*]} " =~ "data-l1" ]] || [[ " ${LAYERS[*]} " =~ "metagraph-l1-data" ]]; then
        echo
        echo_green "Data L1"
        raw_port=$(yq eval '.base_data_l1_public_port' $ansible_vars_path)
        port=$(($raw_port + $index * $offset))
        local url=http://localhost:$port/node/info
        echo_url "URL:" "$url"
        echo_url "Node info:" "$(curl -s $url)"
      fi
    fi
    echo
    echo
    ((index++))
  done < <(jq -c '.[]' <<<"$NODES")

  echo_green "Clusters"
  if [[ " ${LAYERS[*]} " =~ "global-l0" ]]; then
    echo
    echo_green "Global L0"
    raw_port=$(yq eval '.base_global_l0_public_port' $ansible_vars_path)
    local url=http://localhost:$raw_port/cluster/info
    echo_url "URL:" "$url"
    echo_url "Cluster info:" "$(curl -s $url)"
    echo
  fi

  if [[ " ${LAYERS[*]} " =~ "dag-l1" ]]; then
    echo
    echo_green "DAG L1"
    raw_port=$(yq eval '.base_dag_l1_public_port' $ansible_vars_path)
    local url=http://localhost:$raw_port/cluster/info
    echo_url "URL:" "$url"
    echo_url "Cluster info:" "$(curl -s $url)"
  fi

  if [[ " ${LAYERS[*]} " =~ "metagraph-l0" ]]; then
    echo
    echo_green "Metagraph L0"
    raw_port=$(yq eval '.base_metagraph_l0_public_port' $ansible_vars_path)
    local url=http://localhost:$raw_port/cluster/info
    echo_url "URL:" "$url"
    echo_url "Cluster info:" "$(curl -s $url)"
    echo
  fi

  if [[ " ${LAYERS[*]} " =~ "currency-l1" ]] || [[ " ${LAYERS[*]} " =~ "metagraph-l1-currency" ]]; then
    echo
    echo_green "Currency L1"
    raw_port=$(yq eval '.base_currency_l1_public_port' $ansible_vars_path)
    local url=http://localhost:$raw_port/cluster/info
    echo_url "URL:" "$url"
    echo_url "Cluster info:" "$(curl -s $url)"
    echo
  fi

  if [[ " ${LAYERS[*]} " =~ "data-l1" ]] || [[ " ${LAYERS[*]} " =~ "metagraph-l1-data" ]]; then
    echo
    echo_green "Data L1"
    raw_port=$(yq eval '.base_data_l1_public_port' $ansible_vars_path)
    local url=http://localhost:$raw_port/cluster/info
    echo_url "URL:" "$url"
    echo_url "Cluster info:" "$(curl -s $url)"
    echo
  fi

  echo
  echo_yellow "Docker containers status"
  echo_white
  docker ps -a --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"

  echo
}
