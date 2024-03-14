#!/usr/bin/env bash

function install_project() {
  echo_white "Installing hydra ..."
  echo_white "Installing Framework..."
  create_template project

  chmod -R a+rwx $INFRA_PATH/docker/monitoring
  chmod -R a+rwx $INFRA_PATH/docker/monitoring/grafana/storage/
  chmod -R a+rwx $INFRA_PATH/docker/monitoring/grafana/dashboards/
  chmod -R a+rwx $INFRA_PATH/docker/monitoring/grafana/datasources/
  chmod -R a+rwx $INFRA_PATH/docker/monitoring/prometheus/

  cd $ROOT_PATH
  if [ -d ".git" ]; then
    chmod -R +w .git
    rm -r .git
  fi

  echo_green "Installed"
}