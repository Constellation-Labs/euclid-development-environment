function run_migrations() {
  echo "Starting migrations..."
  echo

  euclid_field_version=$(jq -r '.version // empty' "$ROOT_PATH/euclid.json")
  VERSION=$1

  cd $INFRA_PATH

  if [ ! -d "euclid-development-environment" ]; then
    git clone https://github.com/Constellation-Labs/euclid-development-environment.git
  fi

  cp $ROOT_PATH/euclid.json $ROOT_PATH/old-euclid.json

  if [ -z "$euclid_field_version" ]; then
    echo "Running migration v0.9.0"
    cd $SCRIPTS_PATH
    source ./migrations/v0.9.0.sh
    migrate_v_0_9_0
    VERSION="0.9.0"
  fi

  rm -r -f $INFRA_PATH/euclid-development-environment
  rm -f $ROOT_PATH/old-euclid.json
  contents="$(jq --arg VERSION "$VERSION" ".version = \"$VERSION\"" $ROOT_PATH/euclid.json)" &&
    echo -E "${contents}" >$ROOT_PATH/euclid.json
  echo "migrations finished..."
  echo
}
