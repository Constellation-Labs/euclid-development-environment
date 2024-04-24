function install_template() {
  echo_title "################################## INSTALL TEMPLATE ##################################"
  repo_name_with_git=$(basename "$argc_repo")
  repo_name="${repo_name_with_git%.git}"

  if [ "${argc_list}" ]; then
    echo_yellow "Fetching templates..."

    cd $INFRA_PATH
    rm -r -f $INFRA_PATH/$repo_name
    git clone --quiet $argc_repo >/dev/null

    echo_yellow ""
    echo_yellow "Available templates"
    echo_green ""
    ls -1 $INFRA_PATH/$repo_name/$argc_path

    rm -rf $INFRA_PATH/$repo_name

    echo_green ""
    exit 0
  fi

  if [ -z "${argc_name}" ]; then
    echo_red "You should provide the repository name"
    exit 1
  fi

  echo_green "##########################################"
  echo_url "Project name:" $argc_name
  echo_url "Repository URL:" $argc_repo
  echo_url "Repository Name:" $repo_name
  echo_url "Path:" $argc_path
  echo_green "##########################################"

  cd $INFRA_PATH
  rm -r -f $INFRA_PATH/$repo_name
  git clone --quiet $argc_repo >/dev/null

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

  
}
