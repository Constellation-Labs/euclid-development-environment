#!/usr/bin/env bash

function install_project() {
  echo_title "################################## INSTALL ##################################"
  echo_white "Installing hydra ..."
  echo_white "Installing Framework..."
  create_template project

  cd $ROOT_PATH
  if [ -d ".git" ]; then
    chmod -R +w .git
    rm -r .git
  fi

  echo_green "Installed"
  
}