function update_json_if_not_empty() {
  local variable_name="$1"
  local json_key="$2"
  local value="$3"
  local is_json_field="$4"

  if [ "$value" ]; then
    if [[ "$is_json_field" == "false" || -z "$is_json_field" ]]; then
      contents="$(jq --arg $variable_name "$value" "$json_key = \"$value\"" $ROOT_PATH/euclid.json)" &&
        echo -E "${contents}" >$ROOT_PATH/euclid.json
    else
      contents="$(jq --argjson $variable_name "$value" "$json_key = $value" $ROOT_PATH/euclid.json)" &&
        echo -E "${contents}" >$ROOT_PATH/euclid.json
    fi

  fi
}

function migrate_v_0_9_0() {
  cd "$INFRA_PATH/euclid-development-environment" || return 1
  git checkout v0.9.0
  cd "$ROOT_PATH" || return 1
  cp "$INFRA_PATH/euclid-development-environment/euclid.json" euclid.json || return 1

  GITHUB_TOKEN=$(jq -r '.github_token // empty' "$ROOT_PATH/old-euclid.json")
  TESSELLATION_VERSION=$(jq -r '.tessellation_version // empty' "$ROOT_PATH/old-euclid.json")
  PROJECT_NAME=$(jq -r '.project_name // empty' "$ROOT_PATH/old-euclid.json")
  FRAMEWORK=$(jq -r '.framework // empty' "$ROOT_PATH/old-euclid.json")
  P12_GENESIS_FILE_NAME=$(jq -r '.p12_files.genesis.file_name // empty' "$ROOT_PATH/old-euclid.json")
  P12_GENESIS_ALIAS=$(jq -r '.p12_files.genesis.alias // empty' "$ROOT_PATH/old-euclid.json")
  P12_GENESIS_PASSWORD=$(jq -r '.p12_files.genesis.password // empty' "$ROOT_PATH/old-euclid.json")
  P12_NODE_2_FILE_NAME=$(jq -r '.p12_files.validators[0].file_name // empty' "$ROOT_PATH/old-euclid.json")
  P12_NODE_2_ALIAS=$(jq -r '.p12_files.validators[0].alias // empty' "$ROOT_PATH/old-euclid.json")
  P12_NODE_2_PASSWORD=$(jq -r '.p12_files.validators[0].password // empty' "$ROOT_PATH/old-euclid.json")
  P12_NODE_3_FILE_NAME=$(jq -r '.p12_files.validators[1].file_name // empty' "$ROOT_PATH/old-euclid.json")
  P12_NODE_3_ALIAS=$(jq -r '.p12_files.validators[1].alias // empty' "$ROOT_PATH/old-euclid.json")
  P12_NODE_3_PASSWORD=$(jq -r '.p12_files.validators[1].password // empty' "$ROOT_PATH/old-euclid.json")
  DOCKER_DEFAULT_CONTAINERS=$(jq -r '.docker.default_containers // empty' "$ROOT_PATH/old-euclid.json")

  if [[ $DOCKER_DEFAULT_CONTAINERS == *"monitoring"* ]]; then
    START_MONITORING=true
  else
    START_MONITORING=false
  fi

  update_json_if_not_empty "GITHUB_TOKEN" ".github_token" "$GITHUB_TOKEN"
  update_json_if_not_empty "TESSELLATION_VERSION" ".tessellation_version" "$TESSELLATION_VERSION"
  update_json_if_not_empty "PROJECT_NAME" ".project_name" "$PROJECT_NAME"
  update_json_if_not_empty "FRAMEWORK" ".framework" "$FRAMEWORK" true
  update_json_if_not_empty "P12_GENESIS_FILE_NAME" ".nodes[0].key_file.name" "$P12_GENESIS_FILE_NAME"
  update_json_if_not_empty "P12_GENESIS_ALIAS" ".nodes[0].key_file.alias" "$P12_GENESIS_ALIAS"
  update_json_if_not_empty "P12_GENESIS_PASSWORD" ".nodes[0].key_file.password" "$P12_GENESIS_PASSWORD"
  update_json_if_not_empty "P12_NODE_2_FILE_NAME" ".nodes[1].key_file.name" "$P12_NODE_2_FILE_NAME"
  update_json_if_not_empty "P12_NODE_2_ALIAS" ".nodes[1].key_file.alias" "$P12_NODE_2_ALIAS"
  update_json_if_not_empty "P12_NODE_2_PASSWORD" ".nodes[1].key_file.password" "$P12_NODE_2_PASSWORD"
  update_json_if_not_empty "P12_NODE_3_FILE_NAME" ".nodes[2].key_file.name" "$P12_NODE_3_FILE_NAME"
  update_json_if_not_empty "P12_NODE_3_ALIAS" ".nodes[2].key_file.alias" "$P12_NODE_3_ALIAS"
  update_json_if_not_empty "P12_NODE_3_PASSWORD" ".nodes[2].key_file.password" "$P12_NODE_3_PASSWORD"
  update_json_if_not_empty "DOCKER_DEFAULT_CONTAINERS" ".layers" "$DOCKER_DEFAULT_CONTAINERS" true
  update_json_if_not_empty "DEPLOY" ".deploy" "$DEPLOY" true
  update_json_if_not_empty "START_MONITORING" ".docker.start_monitoring_container" "$START_MONITORING"
}
