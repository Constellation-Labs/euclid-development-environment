#!/usr/bin/env bash

function build_containers() {
  check_if_tessellation_version_starts_with_v
  if [[ -z "$GITHUB_TOKEN" ]]; then
    echo_red "You should provide the GITHUB_TOKEN on euclid.json file"
    exit 1
  fi

  check_if_github_token_is_valid
  check_p12_files
  check_if_project_name_is_set
  check_if_project_directory_exists
  create_docker_custom_network

  check_if_tessellation_version_of_project_matches_euclid_json

  if [[ -z "$(docker images -q metagraph-base-image-${TESSELLATION_VERSION})" || ! -z "$argc_rebuild_tessellation" ]]; then
    echo
    echo
    echo_white "Building ubuntu base image..."
    cd $INFRA_PATH/docker/metagraph-base-image

    CHECKOUT_TESSELLATION_VERSION=$(get_checkout_tessellation_version "$TESSELLATION_VERSION")
    SHOULD_USE_UPDATED_MODULES=$(get_should_use_updated_modules "$TESSELLATION_VERSION")
    if [ ! -z "$argc_no_cache" ]; then
      $dockercompose build \
        --build-arg GIT_PERSONAL_ACCESS_TOKEN=$GITHUB_TOKEN \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION \
        --build-arg CHECKOUT_TESSELLATION_VERSION=$CHECKOUT_TESSELLATION_VERSION \
        --build-arg SHOULD_USE_UPDATED_MODULES=$SHOULD_USE_UPDATED_MODULES \
        --no-cache
    else
      $dockercompose build \
        --build-arg GIT_PERSONAL_ACCESS_TOKEN=$GITHUB_TOKEN \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION \
        --build-arg CHECKOUT_TESSELLATION_VERSION=$CHECKOUT_TESSELLATION_VERSION \
        --build-arg SHOULD_USE_UPDATED_MODULES=$SHOULD_USE_UPDATED_MODULES
    fi
    echo_green "Ubuntu image built"
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "global-l0" ]]; then
    echo
    echo
    echo_title "GLOBAL-L0"
    echo

    export FORCE_ROLLBACK=false
    cd $INFRA_PATH/docker/global-l0
    if [ ! -z "$argc_no_cache" ]; then
      echo_white "Building Global L0 image... (NO CACHE)"
      $dockercompose build \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION \
        --build-arg GIT_PERSONAL_ACCESS_TOKEN=$GITHUB_TOKEN \
        --build-arg P12_FILE_NAME=$P12_GENESIS_FILE_NAME \
        --build-arg P12_FILE_KEY_ALIAS=$P12_GENESIS_FILE_KEY_ALIAS \
        --build-arg P12_FILE_PASSWORD=$P12_GENESIS_FILE_PASSWORD \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION \
        --no-cache
    else
      echo_white "Building Global L0 image... (USING CACHE)"
      $dockercompose build \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION \
        --build-arg GIT_PERSONAL_ACCESS_TOKEN=$GITHUB_TOKEN \
        --build-arg P12_FILE_NAME=$P12_GENESIS_FILE_NAME \
        --build-arg P12_FILE_KEY_ALIAS=$P12_GENESIS_FILE_KEY_ALIAS \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION \
        --build-arg P12_FILE_PASSWORD=$P12_GENESIS_FILE_PASSWORD
    fi
    echo_green "Global L0 image built"
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "dag-l1" ]]; then
    echo
    echo
    echo_title "DAG-L1"
    echo
    cd $INFRA_PATH/docker/dag-l1
    if [ ! -z "$argc_no_cache" ]; then
      echo_white "Building DAG L1 image... (NO CACHE)"
      $dockercompose build \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION \
        --build-arg GIT_PERSONAL_ACCESS_TOKEN=$GITHUB_TOKEN \
        --build-arg P12_FILE_NAME_GENESIS=$P12_GENESIS_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_2=$P12_NODE_2_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_3=$P12_NODE_3_FILE_NAME \
        --build-arg P12_FILE_KEY_ALIAS_GENESIS=$P12_GENESIS_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_2=$P12_NODE_2_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_3=$P12_NODE_3_FILE_KEY_ALIAS \
        --build-arg P12_FILE_PASSWORD_GENESIS=$P12_GENESIS_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_2=$P12_NODE_2_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_3=$P12_NODE_3_FILE_PASSWORD \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION \
        --no-cache
    else
      echo_white "Building DAG L1 image... (USING CACHE)"
      $dockercompose build \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION \
        --build-arg GIT_PERSONAL_ACCESS_TOKEN=$GITHUB_TOKEN \
        --build-arg P12_FILE_NAME_GENESIS=$P12_GENESIS_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_2=$P12_NODE_2_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_3=$P12_NODE_3_FILE_NAME \
        --build-arg P12_FILE_KEY_ALIAS_GENESIS=$P12_GENESIS_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_2=$P12_NODE_2_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_3=$P12_NODE_3_FILE_KEY_ALIAS \
        --build-arg P12_FILE_PASSWORD_GENESIS=$P12_GENESIS_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_2=$P12_NODE_2_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_3=$P12_NODE_3_FILE_PASSWORD \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION
    fi
    echo_green "DAG L1 image built"
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l0" ]]; then
    echo
    echo
    echo_title "METAGRAPH-L0"
    echo

    export FORCE_ROLLBACK=false
    export METAGRAPH_ID=""
    cd $INFRA_PATH/docker/metagraph-l0/genesis
    if [ ! -z "$argc_no_cache" ]; then
      echo_white "Building Metagraph L0 image... (NO CACHE)"
      $dockercompose build \
        --build-arg TEMPLATE_NAME=$PROJECT_NAME \
        --build-arg GIT_PERSONAL_ACCESS_TOKEN=$GITHUB_TOKEN \
        --build-arg P12_FILE_NAME_GENESIS=$P12_GENESIS_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_2=$P12_NODE_2_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_3=$P12_NODE_3_FILE_NAME \
        --build-arg P12_FILE_KEY_ALIAS_GENESIS=$P12_GENESIS_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_2=$P12_NODE_2_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_3=$P12_NODE_3_FILE_KEY_ALIAS \
        --build-arg P12_FILE_PASSWORD_GENESIS=$P12_GENESIS_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_2=$P12_NODE_2_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_3=$P12_NODE_3_FILE_PASSWORD \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION \
        --no-cache

      cd $INFRA_PATH/docker/metagraph-l0

      $dockercompose build \
        --build-arg TEMPLATE_NAME=$PROJECT_NAME \
        --build-arg GIT_PERSONAL_ACCESS_TOKEN=$GITHUB_TOKEN \
        --build-arg P12_FILE_NAME_GENESIS=$P12_GENESIS_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_2=$P12_NODE_2_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_3=$P12_NODE_3_FILE_NAME \
        --build-arg P12_FILE_KEY_ALIAS_GENESIS=$P12_GENESIS_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_2=$P12_NODE_2_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_3=$P12_NODE_3_FILE_KEY_ALIAS \
        --build-arg P12_FILE_PASSWORD_GENESIS=$P12_GENESIS_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_2=$P12_NODE_2_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_3=$P12_NODE_3_FILE_PASSWORD \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION \
        --no-cache
    else
      echo_white "Building Metagraph L0 image... (USING CACHE)"
      $dockercompose build \
        --build-arg TEMPLATE_NAME=$PROJECT_NAME \
        --build-arg GIT_PERSONAL_ACCESS_TOKEN=$GITHUB_TOKEN \
        --build-arg P12_FILE_NAME_GENESIS=$P12_GENESIS_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_2=$P12_NODE_2_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_3=$P12_NODE_3_FILE_NAME \
        --build-arg P12_FILE_KEY_ALIAS_GENESIS=$P12_GENESIS_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_2=$P12_NODE_2_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_3=$P12_NODE_3_FILE_KEY_ALIAS \
        --build-arg P12_FILE_PASSWORD_GENESIS=$P12_GENESIS_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_2=$P12_NODE_2_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_3=$P12_NODE_3_FILE_PASSWORD \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION

      cd $INFRA_PATH/docker/metagraph-l0
      $dockercompose build \
        --build-arg TEMPLATE_NAME=$PROJECT_NAME \
        --build-arg GIT_PERSONAL_ACCESS_TOKEN=$GITHUB_TOKEN \
        --build-arg P12_FILE_NAME_GENESIS=$P12_GENESIS_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_2=$P12_NODE_2_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_3=$P12_NODE_3_FILE_NAME \
        --build-arg P12_FILE_KEY_ALIAS_GENESIS=$P12_GENESIS_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_2=$P12_NODE_2_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_3=$P12_NODE_3_FILE_KEY_ALIAS \
        --build-arg P12_FILE_PASSWORD_GENESIS=$P12_GENESIS_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_2=$P12_NODE_2_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_3=$P12_NODE_3_FILE_PASSWORD \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION
    fi
    echo_green "Metagraph L0 image built"
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "currency-l1" ]] || [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-currency" ]]; then
    echo
    echo
    echo_title "currency-l1"
    echo
    cd $INFRA_PATH/docker/currency-l1
    if [ ! -z "$argc_no_cache" ]; then
      echo_white "Building Metagraph L1 Currency image... (NO CACHE)"
      $dockercompose build \
        --build-arg TEMPLATE_NAME=$PROJECT_NAME \
        --build-arg GIT_PERSONAL_ACCESS_TOKEN=$GITHUB_TOKEN \
        --build-arg P12_FILE_NAME_GENESIS=$P12_GENESIS_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_2=$P12_NODE_2_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_3=$P12_NODE_3_FILE_NAME \
        --build-arg P12_FILE_KEY_ALIAS_GENESIS=$P12_GENESIS_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_2=$P12_NODE_2_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_3=$P12_NODE_3_FILE_KEY_ALIAS \
        --build-arg P12_FILE_PASSWORD_GENESIS=$P12_GENESIS_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_2=$P12_NODE_2_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_3=$P12_NODE_3_FILE_PASSWORD \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION \
        --no-cache
    else
      echo_white "Building Metagraph L1 Currency image... (USING CACHE)"
      $dockercompose build \
        --build-arg TEMPLATE_NAME=$PROJECT_NAME \
        --build-arg GIT_PERSONAL_ACCESS_TOKEN=$GITHUB_TOKEN \
        --build-arg P12_FILE_NAME_GENESIS=$P12_GENESIS_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_2=$P12_NODE_2_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_3=$P12_NODE_3_FILE_NAME \
        --build-arg P12_FILE_KEY_ALIAS_GENESIS=$P12_GENESIS_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_2=$P12_NODE_2_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_3=$P12_NODE_3_FILE_KEY_ALIAS \
        --build-arg P12_FILE_PASSWORD_GENESIS=$P12_GENESIS_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_2=$P12_NODE_2_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_3=$P12_NODE_3_FILE_PASSWORD \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION
    fi
    echo_green "Metagraph L1 Currency image built"
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "data-l1" ]] || [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-data" ]]; then
    echo
    echo
    echo_title "data-l1"
    echo
    cd $INFRA_PATH/docker/data-l1
    if [ ! -z "$argc_no_cache" ]; then
      echo_white "Building Metagraph L1 Data image... (NO CACHE)"
      $dockercompose build \
        --build-arg TEMPLATE_NAME=$PROJECT_NAME \
        --build-arg GIT_PERSONAL_ACCESS_TOKEN=$GITHUB_TOKEN \
        --build-arg P12_FILE_NAME_GENESIS=$P12_GENESIS_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_2=$P12_NODE_2_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_3=$P12_NODE_3_FILE_NAME \
        --build-arg P12_FILE_KEY_ALIAS_GENESIS=$P12_GENESIS_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_2=$P12_NODE_2_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_3=$P12_NODE_3_FILE_KEY_ALIAS \
        --build-arg P12_FILE_PASSWORD_GENESIS=$P12_GENESIS_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_2=$P12_NODE_2_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_3=$P12_NODE_3_FILE_PASSWORD \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION \
        --no-cache
    else
      echo_white "Building Metagraph L1 Data image... (USING CACHE)"
      $dockercompose build \
        --build-arg TEMPLATE_NAME=$PROJECT_NAME \
        --build-arg GIT_PERSONAL_ACCESS_TOKEN=$GITHUB_TOKEN \
        --build-arg P12_FILE_NAME_GENESIS=$P12_GENESIS_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_2=$P12_NODE_2_FILE_NAME \
        --build-arg P12_FILE_NAME_NODE_3=$P12_NODE_3_FILE_NAME \
        --build-arg P12_FILE_KEY_ALIAS_GENESIS=$P12_GENESIS_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_2=$P12_NODE_2_FILE_KEY_ALIAS \
        --build-arg P12_FILE_KEY_ALIAS_NODE_3=$P12_NODE_3_FILE_KEY_ALIAS \
        --build-arg P12_FILE_PASSWORD_GENESIS=$P12_GENESIS_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_2=$P12_NODE_2_FILE_PASSWORD \
        --build-arg P12_FILE_PASSWORD_NODE_3=$P12_NODE_3_FILE_PASSWORD \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION
    fi
    echo_green "Metagraph L1 Data image built"
  fi

  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "monitoring" ]]; then
    echo
    echo
    echo_title MONITORING
    echo
    cd $INFRA_PATH/docker/monitoring
    if [ ! -z "$argc_no_cache" ]; then
      echo_white "Building monitoring image... (NO CACHE)"
      $dockercompose build --no-cache
    else
      echo_white "Building monitoring image... (USING CACHE)"
      $dockercompose build
    fi
    echo_green "monitoring image built"
  fi

  if [ ! -z "$argc_run" ]; then
    export FORCE_ROLLBACK=false
    start_containers false
  fi

  echo_white "Cleaning up dangling docker images"
  docker image prune -f

  echo_yellow "Project $PROJECT_NAME built"

  exit
}
