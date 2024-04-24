function version_greater_than() {
    [[ "$1" = "$(echo -e "$1\n$2" | sort -V | tail -n 1)" ]] && [[ "$1" != "$2" ]]
}

function run_migrations() {
  echo_title "Starting migrations..."
  echo_white
  cd $INFRA_PATH

  CURRENT_VERSION=$(jq -r '.version // "0.0.0"' "$ROOT_PATH/euclid.json")
  CURRENT_VERSION_WITHOUT_V="${CURRENT_VERSION#v}"

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

  echo "migrations finished..."
  echo
}