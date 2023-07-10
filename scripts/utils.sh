#!/usr/bin/env bash

function fill_env_variables_from_json_config_file() {
  export GITHUB_TOKEN=$(jq -r .github_token hydra.cfg.json)
  export METAGRAPH_ID=$(jq -r .metagraph_id hydra.cfg.json)
  export TESSELLATION_VERSION=$(jq -r .tessellation_version hydra.cfg.json)
  export TEMPLATE_VERSION=$(jq -r .framework.version hydra.cfg.json)
  export TEMPLATE_VERSION_IS_TAG_OR_BRANCH=$(jq -r .framework.ref_type hydra.cfg.json)
  export FRAMEWORK_NAME=$(jq -r .framework.name hydra.cfg.json)
  export FRAMEWORK_MODULES=$(jq -r .framework.modules hydra.cfg.json)
  export P12_GENESIS_FILE_NAME=$(jq -r .p12_files.genesis.file_name hydra.cfg.json)
  export P12_GENESIS_FILE_KEY_ALIAS=$(jq -r .p12_files.genesis.alias hydra.cfg.json)
  export P12_GENESIS_FILE_PASSWORD=$(jq -r .p12_files.genesis.password hydra.cfg.json)
  export P12_NODE_2_FILE_NAME=$(jq -r .p12_files.validators[0].file_name hydra.cfg.json)
  export P12_NODE_2_FILE_KEY_ALIAS=$(jq -r .p12_files.validators[0].alias hydra.cfg.json)
  export P12_NODE_2_FILE_PASSWORD=$(jq -r .p12_files.validators[0].password hydra.cfg.json)
  export P12_NODE_3_FILE_NAME=$(jq -r .p12_files.validators[1].file_name hydra.cfg.json)
  export P12_NODE_3_FILE_KEY_ALIAS=$(jq -r .p12_files.validators[1].alias hydra.cfg.json)
  export P12_NODE_3_FILE_PASSWORD=$(jq -r .p12_files.validators[1].password hydra.cfg.json)
  
  containers_array=$(jq -r .docker.default_containers hydra.cfg.json)
  export DOCKER_CONTAINERS=( $(echo $containers_array | sed -e 's/\[//g' -e 's/\"//g' -e 's/\]//g' -e 's/\,/ /g') )
}

function check_if_github_token_is_valid() {
    if curl -s -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user | grep -q "Bad credentials"; then
        echo "Invalid GITHUB_TOKEN"
        exit 1
    fi
}

function checkout_tessellation_version() {
    cd $2/
    echo "Checking version $1"
    if [ ! -z "$(git ls-remote origin $1)" ]; then
        git pull &>/dev/null
        git checkout $1 &>/dev/null
        echo "Valid version"
        cd ../
    else
        echo "Invalid version"
        exit 1
    fi
}

function get_metagraph_id_from_genesis_currency_l0() {
    for ((i = 1; i <= 11; i++)); do
        METAGRAPH_ID=$(docker logs l0-currency-1 -n 1000 2>&1 | grep -o "Address from genesis data is .*" | grep -o "DAG.*")
        if [[ -z "$METAGRAPH_ID" ]]; then
            if [ $i -eq 10 ]; then
                echo "Could not find the metagraph_id, check the currency L0 node 1 logs"
                exit 1
            fi
            echo "metagraph_id not found trying again in 30s"
            sleep 30
        else
            cd ../../../
            echo "METAGRAPH_ID found: $METAGRAPH_ID"
            echo "Filling the hydra.cfg.json file"
            contents="$(jq --arg METAGRAPH_ID "$METAGRAPH_ID" '.metagraph_id = $METAGRAPH_ID' hydra.cfg.json)" && \
            echo -E "${contents}" > hydra.cfg.json
            
            fill_env_variables_from_json_config_file
            
            cd infra/docker/metagraph-l0-genesis
            break
        fi
    done
}

function check_p12_files() {
    echo "All 3 P12 files should be inserted on source/p12-files directory"
    if [ ! -f "../source/p12-files/$P12_GENESIS_FILE_NAME" ]; then
        echo "File does not exists"
        exit 1
    fi
    
    if [ ! -f "../source/p12-files/$P12_NODE_2_FILE_NAME" ]; then
        echo "File does not exists"
        exit 1
    fi
    
    if [ ! -f "../source/p12-files/$P12_NODE_3_FILE_NAME" ]; then
        echo "File does not exists"
        exit 1
    fi
}