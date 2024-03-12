#!/usr/bin/env bash

function check_if_container_is_running() {
  if docker ps --format '{{.Names}}' | grep "$1"; then
    echo You should stop the container $1 before update
    exit 1
  fi
}

function checkout_version() {
  if [ ! -z "$(git ls-remote origin $1)" ]; then
    git pull &>/dev/null
    git checkout $1 &>/dev/null
    echo "Valid version"
  else
    echo "Invalid version"
    exit 1
  fi
}

function check_if_should_update() {
  echo "This operation will update the following files/directories:"
  echo "Directory - infra/docker"
  echo "Directory - scripts"
  echo "File - infra/ansible/hosts.ansible.yml"
  echo "File - infra/ansible/playbooks/deploy/configure.ansible.yml"
  echo "File - infra/ansible/playbooks/deploy/deploy.ansible.yml"
  echo "File - infra/ansible/playbooks/start/clean.ansible.yml"
  echo "File - infra/ansible/playbooks/start/start.ansible.yml"
  echo "File - infra/ansible/playbooks/start/currency-l1/cluster.ansible.yml"
  echo "File - infra/ansible/playbooks/start/currency-l1/initial_validator.ansible.yml"
  echo "File - infra/ansible/playbooks/start/currency-l1/validator.ansible.yml"
  echo "File - infra/ansible/playbooks/start/data-l1/cluster.ansible.yml"
  echo "File - infra/ansible/playbooks/start/data-l1/initial_validator.ansible.yml"
  echo "File - infra/ansible/playbooks/start/data-l1/validator.ansible.yml"
  echo "File - infra/ansible/playbooks/start/metagraph-l0/cluster.ansible.yml"
  echo "File - infra/ansible/playbooks/start/metagraph-l0/genesis.ansible.yml"
  echo "File - infra/ansible/playbooks/start/metagraph-l0/validator.ansible.yml"

  default="N"
  echo "Do you want to proceed? (Y/N, default: $default): "
  read -r input

  if [ -z "$input" ]; then
    input="$default"
  fi

  input=$(echo "$input" | tr '[:lower:]' '[:upper:]')

  if [[ "$input" == "N" ]]; then
    exit 0
  fi

  if [[ "$input" != "N" && "$input" != "Y" ]]; then
    echo "Invalid input. Please enter 'Y' or 'N'."
    exit 0
  fi
}

function check_if_any_container_is_running() {
  echo "You should stop all containers before update"

  echo "Checking if any container is running ..."
  check_if_container_is_running global-l0-1

  check_if_container_is_running dag-l1-1
  check_if_container_is_running dag-l1-2
  check_if_container_is_running dag-l1-3

  check_if_container_is_running metagraph-l0-1
  check_if_container_is_running metagraph-l0-2
  check_if_container_is_running metagraph-l0-3

  check_if_container_is_running currency-l1-1
  check_if_container_is_running currency-l1-2
  check_if_container_is_running currency-l1-3

  check_if_container_is_running data-l1-1
  check_if_container_is_running data-l1-2
  check_if_container_is_running data-l1-3

  check_if_container_is_running grafana
  check_if_container_is_running prometheus
}

function update_infra_docker() {
  cd $INFRA_PATH
  echo "Updating docker folder ..."
  chmod +x docker
  rm -r docker

  cp -r euclid-development-environment/infra/docker .
  echo "Updated"
}

function update_scripts() {
  echo "Updating scripts ..."
  cd $ROOT_PATH
  chmod +x scripts
  rm -r scripts

  cp -r infra/euclid-development-environment/scripts .
  echo "Updated"
}

function update_ansible_files() {
  cd $INFRA_PATH
  echo "Updating ansible files..."

  ANSIBLE_DIRECTORY="$INFRA_PATH/ansible"

  if [ -d "$DIRECTORY" ]; then
    chmod +x ansible/hosts.ansible.yml
    rm -r ansible/hosts.ansible.yml
    cp euclid-development-environment/infra/ansible/hosts.ansible.yml .

    chmod +x ansible/playbooks/deploy/configure.ansible.yml
    rm -r ansible/playbooks/deploy/configure.ansible.yml
    cp euclid-development-environment/infra/ansible/playbooks/deploy/configure.ansible.yml .

    chmod +x ansible/playbooks/deploy/deploy.ansible.yml
    rm -r ansible/playbooks/deploy/deploy.ansible.yml
    cp euclid-development-environment/infra/ansible/playbooks/deploy/deploy.ansible.yml .

    chmod +x ansible/playbooks/start/clean.ansible.yml
    rm -r ansible/playbooks/start/clean.ansible.yml
    cp euclid-development-environment/infra/ansible/playbooks/start/clean.ansible.yml .

    chmod +x ansible/playbooks/start/start.ansible.yml
    rm -r ansible/playbooks/start/start.ansible.yml
    cp euclid-development-environment/infra/ansible/playbooks/start/start.ansible.yml .

    chmod +x ansible/playbooks/start/currency-l1/cluster.ansible.yml
    rm -r ansible/playbooks/start/currency-l1/cluster.ansible.yml
    cp euclid-development-environment/infra/ansible/playbooks/start/currency-l1/cluster.ansible.yml .

    chmod +x ansible/playbooks/start/currency-l1/initial_validator.ansible.yml
    rm -r ansible/playbooks/start/currency-l1/initial_validator.ansible.yml
    cp euclid-development-environment/infra/ansible/playbooks/start/currency-l1/initial_validator.ansible.yml .

    chmod +x ansible/playbooks/start/currency-l1/validator.ansible.yml
    rm -r ansible/playbooks/start/currency-l1/validator.ansible.yml
    cp euclid-development-environment/infra/ansible/playbooks/start/currency-l1/validator.ansible.yml .

    chmod +x ansible/playbooks/start/data-l1/cluster.ansible.yml
    rm -r ansible/playbooks/start/data-l1/cluster.ansible.yml
    cp euclid-development-environment/infra/ansible/playbooks/start/data-l1/cluster.ansible.yml .

    chmod +x ansible/playbooks/start/data-l1/initial_validator.ansible.yml
    rm -r ansible/playbooks/start/data-l1/initial_validator.ansible.yml
    cp euclid-development-environment/infra/ansible/playbooks/start/data-l1/initial_validator.ansible.yml .

    chmod +x ansible/playbooks/start/data-l1/validator.ansible.yml
    rm -r ansible/playbooks/start/data-l1/validator.ansible.yml
    cp euclid-development-environment/infra/ansible/playbooks/start/data-l1/validator.ansible.yml .

    chmod +x ansible/playbooks/start/metagraph-l0/cluster.ansible.yml
    rm -r ansible/playbooks/start/metagraph-l0/cluster.ansible.yml
    cp euclid-development-environment/infra/ansible/playbooks/start/metagraph-l0/cluster.ansible.yml .

    chmod +x ansible/playbooks/start/metagraph-l0/genesis.ansible.yml
    rm -r ansible/playbooks/start/metagraph-l0/genesis.ansible.yml
    cp euclid-development-environment/infra/ansible/playbooks/start/metagraph-l0/genesis.ansible.yml .

    chmod +x ansible/playbooks/start/metagraph-l0/validator.ansible.yml
    rm -r ansible/playbooks/start/metagraph-l0/validator.ansible.yml
    cp euclid-development-environment/infra/ansible/playbooks/start/metagraph-l0/validator.ansible.yml .

  else
    chmod +x ansible
    rm -r ansible

    cp -r euclid-development-environment/infra/ansible .
  fi

  echo "Updated"
}

update_euclid() {
  check_if_should_update
  check_if_any_container_is_running

  cd $INFRA_PATH

  echo "Starting update ..."
  echo "Getting updated version"
  git clone --quiet https://github.com/Constellation-Labs/euclid-development-environment.git > /dev/null
  cd euclid-development-environment/
  checkout_version $argc_euclid_version

  update_infra_docker
  update_scripts
  update_ansible_files

  chmod -R +w $INFRA_PATH/euclid-development-environment
  rm -r $INFRA_PATH/euclid-development-environment
  echo "Updating process finished!"
}
