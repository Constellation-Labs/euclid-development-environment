function install_template() {
  echo_title "################################## INSTALL TEMPLATE ##################################"
  repo_name_with_git=$(basename "$argc_repo")
  repo_name="${repo_name_with_git%.git}"

  if [ "${argc_list}" ]; then
    echo_yellow "Fetching templates..."

    cd $INFRA_PATH
    rm -r -f $INFRA_PATH/$repo_name
    git clone --quiet $argc_repo >/dev/null

    if [ "${argc_branch}" ]; then
      echo_yellow "Using branch ${argc_branch}"
      cd $INFRA_PATH/$repo_name
      git checkout --quiet $argc_branch >/dev/null
      cd ../
    fi

    echo_yellow ""
    echo_green "=== Available Templates ==="
    ls -1 $INFRA_PATH/$repo_name/$argc_path

    rm -rf $INFRA_PATH/$repo_name

    echo_green ""
    exit 0
  fi

  if [ -z "${argc_name}" ]; then
    echo_red "You must provide a repository name"
    exit 1
  fi

  echo_url "=== Template Details ==="
  echo_url "Project name:" $argc_name
  echo_url "Repository URL:" $argc_repo
  echo_url "Repository Name:" $repo_name
  echo_url "Path:" $argc_path

  cd $INFRA_PATH
  rm -r -f $INFRA_PATH/$repo_name
  git clone --quiet $argc_repo >/dev/null

  if [ "${argc_branch}" ]; then
    echo_url "Branch: " $argc_branch
    cd $INFRA_PATH/$repo_name
    git checkout --quiet $argc_branch >/dev/null
    cd ../
  fi

  echo_green ""

  echo_white "Checking if the template exists on repository..."
  PROJECT_DIRECTORY=$repo_name/$argc_path/$argc_name
  if [ ! -d "$PROJECT_DIRECTORY" ]; then
    echo "$(tput setaf 1) Project does not exists on repository"
    rm -rf $INFRA_PATH/$repo_name
    exit 1
  fi
  echo_white "Template exists!"

  cd $repo_name/$argc_path

  echo_white "Cleaning old directories: template or $argc_name from projects"
  rm -r -f $SOURCE_PATH/project/$argc_name

  echo_white "Moving template to the projects directory"
  mv -n -f $argc_name $SOURCE_PATH/project

  echo_white "Updating euclid.json project_name"
  contents="$(jq --arg PROJECT_NAME "$argc_name" '.project_name = $PROJECT_NAME' $ROOT_PATH/euclid.json)" &&
    echo -E "${contents}" >$ROOT_PATH/euclid.json

  echo_white "Updating euclid.json tessellation_version"
  project_tessellation_version=$(grep "val tessellation =" $SOURCE_PATH/project/$argc_name/project/Dependencies.scala | awk -F '"' '{print $2}')
  contents="$(jq --arg PROJECT_TESSELLATION_VERSION "$project_tessellation_version" '.tessellation_version = $PROJECT_TESSELLATION_VERSION' $ROOT_PATH/euclid.json)" &&
    echo -E "${contents}" >$ROOT_PATH/euclid.json

  rm -r -f $INFRA_PATH/$repo_name

  cd $ROOT_PATH
  if [ -d ".git" ]; then
    chmod -R +w .git
    rm -r .git
  fi

  cat > .gitignore << 'GITIGNORE'
# IDE and editor files
.idea/
.vscode/
*.swp
*.swo
*~

# OS files
.DS_Store

# Scala build artifacts
.metals/
.bloop/
.bsp/
.scala-build/
target/
metals.sbt
**/metals.sbt
project/metals.sbt
project/project/metals.sbt
.scalafmt-cache
.scalafix-cache

# Node
node_modules/

# Jars (downloaded during build)
infra/shared/jars/*.jar

# Genesis files (generated)
source/metagraph-l0/genesis/genesis.address
source/metagraph-l0/genesis/genesis.snapshot
infra/shared/genesis/*

# Grafana data
infra/grafana/grafana/config/
infra/grafana/prometheus/data/
infra/grafana/prometheus/monitoring/

# Monitoring service
source/*-monitoring-service/node_modules
source/*-monitoring-service/config/config.json
source/*-monitoring-service/config/id_monitoring

# Shared data (generated at runtime)
infra/shared/data/*
!infra/shared/data/.gitkeep

# Project config (contains p12 passwords)
euclid.json

# Private key files
source/p12-files/*
!source/p12-files/.gitkeep
GITIGNORE

  git init
  git add -A
  git commit -m "Initial commit after hydra install-template ($argc_name)"

  echo_green ""
  echo_url "Template installed: " $argc_name
}
