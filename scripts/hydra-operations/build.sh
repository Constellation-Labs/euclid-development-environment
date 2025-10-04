#!/usr/bin/env bash

function build_metagraph_ubuntu() {
  if [[ -z "$(docker images -q metagraph-ubuntu-${TESSELLATION_VERSION_NAME})" ]]; then
    echo
    echo
    echo_white "Building metagraph ubuntu for tessellation $TESSELLATION_VERSION in image name metagraph-ubuntu-$TESSELLATION_VERSION_NAME"
    cd $INFRA_PATH/metagraph-ubuntu

    CHECKOUT_TESSELLATION_VERSION=$(get_checkout_tessellation_version "$TESSELLATION_VERSION")

    if [ ! -z "$argc_no_cache" ]; then
      $DOCKER_COMPOSE build \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION \
        --build-arg TESSELLATION_VERSION_SEMVER=$TESSELLATION_VERSION_SEMVER \
        --build-arg CHECKOUT_TESSELLATION_VERSION=$CHECKOUT_TESSELLATION_VERSION \
        --build-arg TESSELLATION_VERSION_IS_TAG_OR_BRANCH=$TESSELLATION_VERSION_IS_TAG_OR_BRANCH \
        --no-cache
    else
      $DOCKER_COMPOSE build \
        --build-arg TESSELLATION_VERSION=$TESSELLATION_VERSION \
        --build-arg TESSELLATION_VERSION_SEMVER=$TESSELLATION_VERSION_SEMVER \
        --build-arg CHECKOUT_TESSELLATION_VERSION=$CHECKOUT_TESSELLATION_VERSION \
        --build-arg TESSELLATION_VERSION_IS_TAG_OR_BRANCH=$TESSELLATION_VERSION_IS_TAG_OR_BRANCH
    fi
    
    echo_green "Ubuntu for tessellation $TESSELLATION_VERSION built"
  else
    echo_green "Ubuntu for tessellation $TESSELLATION_VERSION already built, skipping..."
  fi
}

function get_layers_to_run() {
  local SHOULD_BUILD_GLOBAL_L0=false
  local SHOULD_BUILD_DAG_L1=false
  local SHOULD_BUILD_METAGRAPH_L0=false
  local SHOULD_BUILD_CURRENCY_L1=false
  local SHOULD_BUILD_DATA_L1=false

  if [[ " ${LAYERS[*]} " =~ "global-l0" ]]; then
    SHOULD_BUILD_GLOBAL_L0=true
  fi

  if [[ " ${LAYERS[*]} " =~ "dag-l1" ]]; then
    SHOULD_BUILD_DAG_L1=true
  fi

  if [[ " ${LAYERS[*]} " =~ "metagraph-l0" ]]; then
    SHOULD_BUILD_METAGRAPH_L0=true
  fi

  if [[ " ${LAYERS[*]} " =~ "currency-l1" ]] || [[ " ${LAYERS[*]} " =~ "metagraph-l1-currency" ]]; then
    SHOULD_BUILD_CURRENCY_L1=true
  fi

  if [[ " ${LAYERS[*]} " =~ "data-l1" ]] || [[ " ${LAYERS[*]} " =~ "metagraph-l1-data" ]]; then
    SHOULD_BUILD_DATA_L1=true
  fi

  echo "SHOULD_BUILD_GLOBAL_L0=$SHOULD_BUILD_GLOBAL_L0"
  echo "SHOULD_BUILD_DAG_L1=$SHOULD_BUILD_DAG_L1"
  echo "SHOULD_BUILD_METAGRAPH_L0=$SHOULD_BUILD_METAGRAPH_L0"
  echo "SHOULD_BUILD_CURRENCY_L1=$SHOULD_BUILD_CURRENCY_L1"
  echo "SHOULD_BUILD_DATA_L1=$SHOULD_BUILD_DATA_L1"
}

function build_metagraph_base_image() {
  echo
  echo
  echo_white "Building metagraph base image..."
  cd $INFRA_PATH/metagraph-base-image

  CUSTOM_METAGRAPH_BASE_IMAGE="$INFRA_PATH/docker/custom/metagraph-base-image/Dockerfile"

  if [ -f "$CUSTOM_METAGRAPH_BASE_IMAGE" ]; then
    echo_yellow "Custom Dockerfile detected..."
    export METAGRAPH_BASE_IMAGE_DOCKERFILE=$CUSTOM_METAGRAPH_BASE_IMAGE
  else
    export METAGRAPH_BASE_IMAGE_DOCKERFILE="$INFRA_PATH/metagraph-base-image/Dockerfile"
  fi

  output=$(get_layers_to_run)
  should_build_global_l0=$(echo "$output" | grep '^SHOULD_BUILD_GLOBAL_L0=' | cut -d'=' -f2)
  should_build_dag_l1=$(echo "$output" | grep '^SHOULD_BUILD_DAG_L1=' | cut -d'=' -f2)
  should_build_metagraph_l0=$(echo "$output" | grep '^SHOULD_BUILD_METAGRAPH_L0=' | cut -d'=' -f2)
  should_build_currency_l1=$(echo "$output" | grep '^SHOULD_BUILD_CURRENCY_L1=' | cut -d'=' -f2)
  should_build_data_l1=$(echo "$output" | grep '^SHOULD_BUILD_DATA_L1=' | cut -d'=' -f2)

  if [ ! -z "$argc_no_cache" ]; then
    $DOCKER_COMPOSE build \
      --build-arg TESSELLATION_VERSION_NAME=$TESSELLATION_VERSION_NAME \
      --build-arg TEMPLATE_NAME=$PROJECT_NAME \
      --build-arg SHOULD_BUILD_GLOBAL_L0=$should_build_global_l0 \
      --build-arg SHOULD_BUILD_DAG_L1=$should_build_dag_l1 \
      --build-arg SHOULD_BUILD_METAGRAPH_L0=$should_build_metagraph_l0 \
      --build-arg SHOULD_BUILD_CURRENCY_L1=$should_build_currency_l1 \
      --build-arg SHOULD_BUILD_DATA_L1=$should_build_data_l1 \
      --build-arg METAGRAPH_BASE_IMAGE_DOCKERFILE=$METAGRAPH_BASE_IMAGE_DOCKERFILE \
      --no-cache
  else
    $DOCKER_COMPOSE build \
      --build-arg TESSELLATION_VERSION_NAME=$TESSELLATION_VERSION_NAME \
      --build-arg TEMPLATE_NAME=$PROJECT_NAME \
      --build-arg SHOULD_BUILD_GLOBAL_L0=$should_build_global_l0 \
      --build-arg SHOULD_BUILD_DAG_L1=$should_build_dag_l1 \
      --build-arg SHOULD_BUILD_METAGRAPH_L0=$should_build_metagraph_l0 \
      --build-arg SHOULD_BUILD_CURRENCY_L1=$should_build_currency_l1 \
      --build-arg SHOULD_BUILD_DATA_L1=$should_build_data_l1 \
      --build-arg METAGRAPH_BASE_IMAGE_DOCKERFILE=$METAGRAPH_BASE_IMAGE_DOCKERFILE
  fi

  if [ $? -ne 0 ]; then
    echo_red "Error building Metagraph base image. Check the Docker build output for details."
    exit 1
  fi

  echo_green "Metagraph base image built"

  copy_jars_from_image
}

function copy_jars_from_image() {
  echo_white "Copying jars to infra/shared/jars..."

  # Create temporary container from the base image, to copy jars from
  local container_id=$(docker create metagraph-base-image)

  docker cp "$container_id:/code/shared_jars/." "$INFRA_PATH/shared/jars/"
  docker rm "$container_id" > /dev/null

  echo_green "Jars copied to infra/shared/jars"
}

function build_containers() {
  echo_title "################################## BUILD ##################################"
  check_if_tessellation_version_starts_with_v
  check_p12_files
  check_if_project_name_is_set
  check_if_project_directory_exists
  check_if_tessellation_version_of_project_matches_euclid_json
  check_if_we_have_at_least_3_nodes

  build_metagraph_ubuntu
  build_metagraph_base_image

  if [ ! -z "$argc_run" ]; then
    start_containers true
  fi

}
