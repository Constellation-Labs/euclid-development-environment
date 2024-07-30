#!/usr/bin/env bash

function check_if_the_container_is_running() {
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
  echo "Directory - infra/ansible/local/playbooks/start"
  echo "Directory - infra/ansible/local/playbooks/stop"
  echo "File - infra/ansible/local/playbooks/vars.ansible.yml"
  echo "Directory - infra/ansible/remote/nodes/playbooks/deploy"
  echo "Directory - infra/ansible/remote/nodes/playbooks/start"
  echo "Directory - infra/ansible/remote/monitoring/playbooks/deploy"
  echo "Directory - infra/ansible/remote/monitoring/playbooks/start"
  echo "File - infra/ansible/remote/hosts.ansible.yml"

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
  while IFS= read -r node; do
    name=$(jq -r '.name' <<<"$node")
    check_if_the_container_is_running $name
    echo
  done < <(jq -c '.[]' <<<"$NODES")

  check_if_the_container_is_running grafana
  check_if_the_container_is_running prometheus
}

function update_infra_docker() {
  cd $INFRA_PATH
  echo "Updating docker folder ..."
  chmod -R +x docker
  rm -r docker/grafana
  rm -r docker/metagraph-base-image
  rm -r docker/metagraph-ubuntu
  rm -r docker/shared

  cp -r euclid-development-environment/infra/docker/grafana .
  cp -r euclid-development-environment/infra/docker/metagraph-base-image .
  cp -r euclid-development-environment/infra/docker/metagraph-ubuntu .
  cp -r euclid-development-environment/infra/docker/shared .
  echo "Updated"
}

function update_scripts() {
  echo "Updating scripts ..."
  cd $ROOT_PATH
  chmod -R +x scripts
  rm -r scripts

  cp -r infra/euclid-development-environment/scripts .
  echo "Updated"
}

function update_remote_ansible_files() {
  echo "Updating remote ansible files..."

  ANSIBLE_DIRECTORY="$INFRA_PATH/ansible/remote"
  chmod -R +x $ANSIBLE_DIRECTORY

  if [ -d "$ANSIBLE_DIRECTORY" ]; then
    rm -r $ANSIBLE_DIRECTORY/hosts.ansible.yml
    cp $INFRA_PATH/euclid-development-environment/infra/ansible/remote/hosts.ansible.yml $ANSIBLE_DIRECTORY

    rm -r $ANSIBLE_DIRECTORY/nodes/playbooks/deploy
    cp -r $INFRA_PATH/euclid-development-environment/infra/ansible/remote/nodes/playbooks/deploy $ANSIBLE_DIRECTORY/nodes/playbooks

    rm -r $ANSIBLE_DIRECTORY/nodes/playbooks/start
    cp -r $INFRA_PATH/euclid-development-environment/infra/ansible/remote/nodes/playbooks/start $ANSIBLE_DIRECTORY/nodes/playbooks

    rm -r $ANSIBLE_DIRECTORY/monitoring/playbooks/deploy
    cp -r $INFRA_PATH/euclid-development-environment/infra/ansible/remote/monitoring/playbooks/deploy $ANSIBLE_DIRECTORY/monitoring/playbooks

    rm -r $ANSIBLE_DIRECTORY/monitoring/playbooks/start
    cp -r $INFRA_PATH/euclid-development-environment/infra/ansible/remote/monitoring/playbooks/start $ANSIBLE_DIRECTORY/monitoring/playbooks

  else
    mkdir -p "$INFRA_PATH/ansible"
    cp -r $INFRA_PATH/euclid-development-environment/infra/ansible/remote "$INFRA_PATH/ansible"
  fi

  echo "Updated"
}

function update_local_ansible_files() {
  echo "Updating local ansible files..."

  ANSIBLE_DIRECTORY="$INFRA_PATH/ansible/local"
  chmod -R +x $ANSIBLE_DIRECTORY
  if [ -d "$ANSIBLE_DIRECTORY" ]; then
    rm -r $ANSIBLE_DIRECTORY/playbooks/vars.ansible.yml
    cp $INFRA_PATH/euclid-development-environment/infra/ansible/local/playbooks/vars.ansible.yml $ANSIBLE_DIRECTORY/playbooks

    rm -r $ANSIBLE_DIRECTORY/playbooks/start
    cp -r $INFRA_PATH/euclid-development-environment/infra/ansible/local/playbooks/start $ANSIBLE_DIRECTORY/playbooks

    rm -r $ANSIBLE_DIRECTORY/playbooks/stop
    cp -r $INFRA_PATH/euclid-development-environment/infra/ansible/local/playbooks/stop $ANSIBLE_DIRECTORY/playbooks

  else
    mkdir -p "$INFRA_PATH/ansible"
    cp -r $INFRA_PATH/euclid-development-environment/infra/ansible/local "$INFRA_PATH/ansible"
  fi

  echo "Updated"
}

update_euclid() {
  echo_title "################################## UPDATE ##################################"
  check_if_should_update
  check_if_any_container_is_running

  cd $INFRA_PATH

  echo "Starting update ..."
  echo "Getting updated version"
  git clone --quiet https://github.com/Constellation-Labs/euclid-development-environment.git >/dev/null
  cd euclid-development-environment/
  checkout_version $argc_euclid_version

  update_infra_docker
  update_scripts
  update_remote_ansible_files
  update_local_ansible_files

  if command -v run_migrations &>/dev/null; then
    run_migrations
  fi

  chmod -R +w $INFRA_PATH/euclid-development-environment
  rm -r $INFRA_PATH/euclid-development-environment
  echo "Updating process finished!"
  
}
