function create_template() {
  cd source/$1
  if [ -d "$2" ]; then
    echo "Template already exists!"
  else
    echo "Generating template $1 ..."

    echo "Template version: $TEMPLATE_VERSION"
    echo "Template version is tag or branch: $TEMPLATE_VERSION_IS_TAG_OR_BRANCH"
    echo "Version name to use: $VERSION_NAME_TO_USE"

    if [ "$TEMPLATE_VERSION_IS_TAG_OR_BRANCH" == "tag" ]; then
      g8 Constellation-Labs/currency --tag $TEMPLATE_VERSION --name="$2" --tessellation_version="$VERSION_NAME_TO_USE"
    else
      g8 Constellation-Labs/currency --branch $TEMPLATE_VERSION --name="$2" --tessellation_version="$VERSION_NAME_TO_USE"
    fi

  fi
  cd ../../
}

function check_if_project_name_is_set() {
  if [[ -z "$PROJECT_NAME_CURRENCY" ]]; then
    echo "You should provide the PROJECT_NAME_CURRENCY on hydra.cfg file"
    exit 1
  fi
  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-data" ]]; then
    if [[ -z "$PROJECT_NAME_DATA" ]]; then
      echo "metagraph-l1-data provided"
      echo "You should provide the PROJECT_NAME_DATA on hydra.cfg file"
      exit 1
    fi
  fi

}

function check_if_project_directory_exists() {
  cd ../source/
  if [ ! -d "project/$PROJECT_NAME_CURRENCY" ]; then
    echo "You must install a framework before building. Run hydra install first"
    exit 1
  fi
  if [[ " ${DOCKER_CONTAINERS[*]} " =~ "metagraph-l1-data" ]]; then
    if [ ! -d "project/$PROJECT_NAME_DATA" ]; then
      echo "metagraph-l1-data provided"
      echo "You must install a framework to metagraph-data before building. Run hydra install first"
      exit 1
    fi
  fi
  cd ../scripts/
}
