function version_greater_than() {
    local version1="$1"
    local version2="$2"
    if [[ "$version1" = "$(echo -e "$version1\n$version2" | sort -V | tail -n 1)" ]] && [[ "$version1" != "$version2" ]]; then
        return 0
    else
        return 1
    fi
}

function run_migrations() {
  echo_title "Starting migrations..."
  echo_white
  cd $INFRA_PATH

  CURRENT_VERSION=$(jq -r '.version // "0.0.0"' "$ROOT_PATH/euclid.json")
  CURRENT_VERSION_WITHOUT_V="${CURRENT_VERSION#v}"
  echo_yellow "Current version: $CURRENT_VERSION_WITHOUT_V"

  if version_greater_than "0.9.0" $CURRENT_VERSION_WITHOUT_V; then
    echo "Running migration v0.9.0"
    cd $SCRIPTS_PATH
    source ./migrations/v0.9.0.sh
    migrate_v_0_9_0
    current_version="0.9.0"
    jq --arg current_version "$current_version" '.version = $current_version' $ROOT_PATH/euclid.json > $ROOT_PATH/temp.json && mv $ROOT_PATH/temp.json $ROOT_PATH/euclid.json
  fi

  if version_greater_than "0.10.0" $CURRENT_VERSION_WITHOUT_V; then
    echo "Running migration v0.10.0"
    cd $SCRIPTS_PATH
    source ./migrations/v0.10.0.sh
    migrate_v_0_10_0
    current_version="0.10.0"
    jq --arg current_version "$current_version" '.version = $current_version' $ROOT_PATH/euclid.json > $ROOT_PATH/temp.json && mv $ROOT_PATH/temp.json $ROOT_PATH/euclid.json
  fi

  if version_greater_than "0.11.0" $CURRENT_VERSION_WITHOUT_V; then
    echo "Running migration v0.11.0"
    cd $SCRIPTS_PATH
    source ./migrations/v0.11.0.sh
    migrate_v_0_11_0
    current_version="0.11.0"
    jq --arg current_version "$current_version" '.version = $current_version' $ROOT_PATH/euclid.json > $ROOT_PATH/temp.json && mv $ROOT_PATH/temp.json $ROOT_PATH/euclid.json
  fi

  if version_greater_than "0.12.0" $CURRENT_VERSION_WITHOUT_V; then
    echo "Running migration v0.12.0"
    cd $SCRIPTS_PATH
    source ./migrations/v0.12.0.sh
    migrate_v_0_12_0
    current_version="0.12.0"
    jq --arg current_version "$current_version" '.version = $current_version' $ROOT_PATH/euclid.json > $ROOT_PATH/temp.json && mv $ROOT_PATH/temp.json $ROOT_PATH/euclid.json
  fi
  
  echo "migrations finished..."
  echo
}