#!/usr/bin/env bash
function update_json_if_not_empty() {
  local variable_name="$1"
  local json_key="$2"
  local value="$3"
  local is_json_field="$4"

  if [ "$value" ]; then
    if [[ "$is_json_field" == "false" || -z "$is_json_field" ]]; then
      contents="$(jq --arg $variable_name "$value" "$json_key = \"$value\"" metagraph-monitoring-service/config/config.json)" &&
        echo -E "${contents}" >metagraph-monitoring-service/config/config.json
    else
      contents="$(jq --argjson $variable_name "$value" "$json_key = $value" metagraph-monitoring-service/config/config.json)" &&
        echo -E "${contents}" >metagraph-monitoring-service/config/config.json
    fi

  fi
}

function install_monitoring_service() {
  echo_title "################################## INSTALL REMOTE MONITORING SERVICE ##################################"
  check_if_genesis_files_exists

  METAGRAPH_ID=$(cat $INFRA_PATH/docker/shared/genesis/genesis.address)
  PROJECT_NAME=$(jq -r '.project_name // empty' "$ROOT_PATH/euclid.json")
  VERSION="1.0.0"
  P12_GENESIS_FILE_NAME=$(jq -r '.nodes[0].key_file.name // empty' "$ROOT_PATH/euclid.json")
  P12_GENESIS_ALIAS=$(jq -r '.nodes[0].key_file.alias // empty' "$ROOT_PATH/euclid.json")
  P12_GENESIS_PASSWORD=$(jq -r '.nodes[0].key_file.password // empty' "$ROOT_PATH/euclid.json")
  P12_NODE_2_FILE_NAME=$(jq -r '.nodes[1].key_file.name // empty' "$ROOT_PATH/euclid.json")
  P12_NODE_2_ALIAS=$(jq -r '.nodes[1].key_file.alias // empty' "$ROOT_PATH/euclid.json")
  P12_NODE_2_PASSWORD=$(jq -r '.nodes[1].key_file.password // empty' "$ROOT_PATH/euclid.json")
  P12_NODE_3_FILE_NAME=$(jq -r '.nodes[2].key_file.name // empty' "$ROOT_PATH/euclid.json")
  P12_NODE_3_ALIAS=$(jq -r '.nodes[2].key_file.alias // empty' "$ROOT_PATH/euclid.json")
  P12_NODE_3_PASSWORD=$(jq -r '.nodes[2].key_file.password // empty' "$ROOT_PATH/euclid.json")

  echo_yellow "Downloading the metagraph-monitoring-service under directory $SOURCE_PATH/metagraph-monitoring-service"
  echo_white ""

  cd $SOURCE_PATH
  git clone --quiet https://github.com/Constellation-Labs/metagraph-monitoring-service >/dev/null
  echo_green "metagraph-monitoring-service downloaded"

  echo_yellow "Updating project name in metagraph-monitoring-service/package.json"
  contents="$(jq --arg PROJECT_NAME "$PROJECT_NAME" ".name = \"$PROJECT_NAME-monitoring\"" metagraph-monitoring-service/package.json)" &&
    echo -E "${contents}" >metagraph-monitoring-service/package.json
  echo_green "Updated"

  echo_yellow "Updating the config.json"
  update_json_if_not_empty "PROJECT_NAME" ".metagraph.name" "$PROJECT_NAME"
  update_json_if_not_empty "METAGRAPH_ID" ".metagraph.id" "$METAGRAPH_ID"
  update_json_if_not_empty "VERSION" ".metagraph.version" "$VERSION"
  update_json_if_not_empty "P12_GENESIS_FILE_NAME" ".metagraph.nodes[0].key_file.name" "$P12_GENESIS_FILE_NAME"
  update_json_if_not_empty "P12_GENESIS_ALIAS" ".metagraph.nodes[0].key_file.alias" "$P12_GENESIS_ALIAS"
  update_json_if_not_empty "P12_GENESIS_PASSWORD" ".metagraph.nodes[0].key_file.password" "$P12_GENESIS_PASSWORD"
  update_json_if_not_empty "P12_NODE_2_FILE_NAME" ".metagraph.nodes[1].key_file.name" "$P12_NODE_2_FILE_NAME"
  update_json_if_not_empty "P12_NODE_2_ALIAS" ".metagraph.nodes[1].key_file.alias" "$P12_NODE_2_ALIAS"
  update_json_if_not_empty "P12_NODE_2_PASSWORD" ".metagraph.nodes[1].key_file.password" "$P12_NODE_2_PASSWORD"
  update_json_if_not_empty "P12_NODE_3_FILE_NAME" ".metagraph.nodes[2].key_file.name" "$P12_NODE_3_FILE_NAME"
  update_json_if_not_empty "P12_NODE_3_ALIAS" ".metagraph.nodes[2].key_file.alias" "$P12_NODE_3_ALIAS"
  update_json_if_not_empty "P12_NODE_3_PASSWORD" ".metagraph.nodes[2].key_file.password" "$P12_NODE_3_PASSWORD"
  echo_green "config.json updated"

  chmod -R +w metagraph-monitoring-service/.git 2>/dev/null
  rm -r metagraph-monitoring-service/.git 2>/dev/null
}
