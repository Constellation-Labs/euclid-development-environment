function run_migrations() {
  echo "Starting migrations..."
  echo
  local VERSION=$(jq -r '.version // empty' "$ROOT_PATH/euclid.json")
  cd $INFRA_PATH
  
  if [ ! -d "euclid-development-environment" ]; then
    git clone https://github.com/Constellation-Labs/euclid-development-environment.git
  fi
  
  cp $ROOT_PATH/euclid.json $ROOT_PATH/old-euclid.json

  if [ -z "$VERSION" ]; then
    echo "Running migration v0.9.0"
    cd $SCRIPTS_PATH
    source ./migrations/v0.9.0.sh
    migrate_v_0_9_0
  fi

  rm -r -f $INFRA_PATH/euclid-development-environment
  rm -f $ROOT_PATH/old-euclid.json

  echo "migrations finished..."
  echo
}
