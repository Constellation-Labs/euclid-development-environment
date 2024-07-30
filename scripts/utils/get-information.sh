#!/usr/bin/env bash

function get_env_variables_from_json_config_file() {
    check_if_package_is_installed jq
    check_if_package_is_installed yq
    check_if_config_file_is_the_new_format

    export GITHUB_TOKEN=$(jq -r .github_token $ROOT_PATH/euclid.json)
    export METAGRAPH_ID=$(jq -r .metagraph_id $ROOT_PATH/euclid.json)

    export TESSELLATION_VERSION=$(jq -r .tessellation_version $ROOT_PATH/euclid.json)
    export TESSELLATION_VERSION_IS_TAG_OR_BRANCH=$(jq -r .ref_type $ROOT_PATH/euclid.json)
    export TESSELLATION_VERSION_NAME=$(get_tessellation_version_name $TESSELLATION_VERSION)
    export TESSELLATION_VERSION_SEMVER=$(get_tessellation_version_semver $TESSELLATION_VERSION)

    export TEMPLATE_VERSION=$(jq -r .framework.version $ROOT_PATH/euclid.json)
    export TEMPLATE_VERSION_IS_TAG_OR_BRANCH=$(jq -r .framework.ref_type $ROOT_PATH/euclid.json)

    export PROJECT_NAME=$(jq -r .project_name $ROOT_PATH/euclid.json)
    export FRAMEWORK_NAME=$(jq -r .framework.name $ROOT_PATH/euclid.json)
    export FRAMEWORK_MODULES=$(jq -r .framework.modules $ROOT_PATH/euclid.json)

    export NODES=$(jq -r .nodes $ROOT_PATH/euclid.json)

    export START_GRAFANA_CONTAINER=$(jq -r .docker.start_grafana_container $ROOT_PATH/euclid.json)

    export LAYERS=$(jq -r .layers $ROOT_PATH/euclid.json)

    export DEPLOY_NETWORK_NAME=$(jq -r .deploy.network.name $ROOT_PATH/euclid.json)
    export DEPLOY_NETWORK_HOST_IP=$(jq -r .deploy.network.gl0_node.ip $ROOT_PATH/euclid.json)
    export DEPLOY_NETWORK_HOST_ID=$(jq -r .deploy.network.gl0_node.id $ROOT_PATH/euclid.json)
    export DEPLOY_NETWORK_HOST_PUBLIC_PORT=$(jq -r .deploy.network.gl0_node.public_port $ROOT_PATH/euclid.json)

    export ANSIBLE_HOSTS_FILE=$(jq -r .deploy.ansible.hosts $ROOT_PATH/euclid.json)
    export ANSIBLE_CONFIGURE_PLAYBOOK_FILE=$(jq -r .deploy.ansible.playbooks.configure $ROOT_PATH/euclid.json)
    export ANSIBLE_NODES_DEPLOY_PLAYBOOK_FILE=$(jq -r .deploy.ansible.nodes.playbooks.deploy $ROOT_PATH/euclid.json)
    export ANSIBLE_NODES_START_PLAYBOOK_FILE=$(jq -r .deploy.ansible.nodes.playbooks.start $ROOT_PATH/euclid.json)
    export ANSIBLE_MONITORING_DEPLOY_PLAYBOOK_FILE=$(jq -r .deploy.ansible.monitoring.playbooks.deploy $ROOT_PATH/euclid.json)
    export ANSIBLE_MONITORING_START_PLAYBOOK_FILE=$(jq -r .deploy.ansible.monitoring.playbooks.start $ROOT_PATH/euclid.json)

    export SNAPSHOT_FEES_OWNER_FILE_NAME=$(jq -r .snapshot_fees.owner.key_file.name $ROOT_PATH/euclid.json)
    export SNAPSHOT_FEES_OWNER_ALIAS=$(jq -r .snapshot_fees.owner.key_file.alias $ROOT_PATH/euclid.json)
    export SNAPSHOT_FEES_OWNER_PASSWORD=$(jq -r .snapshot_fees.owner.key_file.password $ROOT_PATH/euclid.json)

    export SNAPSHOT_FEES_STAKING_FILE_NAME=$(jq -r .snapshot_fees.staking.key_file.name $ROOT_PATH/euclid.json)
    export SNAPSHOT_FEES_STAKING_ALIAS=$(jq -r .snapshot_fees.staking.key_file.alias $ROOT_PATH/euclid.json)
    export SNAPSHOT_FEES_STAKING_PASSWORD=$(jq -r .snapshot_fees.staking.key_file.password $ROOT_PATH/euclid.json)

    export ANSIBLE_LOCAL_VARS="$INFRA_PATH/ansible/local/playbooks/vars.ansible.yml"
    export ANSIBLE_LOCAL_CONTAINERS_START_PLAYBOOK_FILE="$INFRA_PATH/ansible/local/playbooks/start/containers/nodes.ansible.yml"
    export ANSIBLE_LOCAL_CONTAINERS_STOP_PLAYBOOK_FILE="$INFRA_PATH/ansible/local/playbooks/stop/containers/nodes.ansible.yml"
    export ANSIBLE_LOCAL_CONTAINERS_DESTROY_PLAYBOOK_FILE="$INFRA_PATH/ansible/local/playbooks/destroy/containers/nodes.ansible.yml"
    export ANSIBLE_LOCAL_GRAFANA_START_PLAYBOOK_FILE="$INFRA_PATH/ansible/local/playbooks/start/containers/grafana.ansible.yml"
    export ANSIBLE_LOCAL_GRAFANA_STOP_PLAYBOOK_FILE="$INFRA_PATH/ansible/local/playbooks/stop/containers/grafana.ansible.yml"
    export ANSIBLE_LOCAL_GLOBAL_L0_START_PLAYBOOK_FILE="$INFRA_PATH/ansible/local/playbooks/start/global-l0/cluster.ansible.yml"
    export ANSIBLE_LOCAL_GLOBAL_L0_STOP_PLAYBOOK_FILE="$INFRA_PATH/ansible/local/playbooks/stop/global-l0/cluster.ansible.yml"
    export ANSIBLE_LOCAL_DAG_L1_START_PLAYBOOK_FILE="$INFRA_PATH/ansible/local/playbooks/start/dag-l1/cluster.ansible.yml"
    export ANSIBLE_LOCAL_DAG_L1_STOP_PLAYBOOK_FILE="$INFRA_PATH/ansible/local/playbooks/stop/dag-l1/cluster.ansible.yml"
    export ANSIBLE_LOCAL_METAGRAPH_L0_START_PLAYBOOK_FILE="$INFRA_PATH/ansible/local/playbooks/start/metagraph-l0/cluster.ansible.yml"
    export ANSIBLE_LOCAL_METAGRAPH_L0_STOP_PLAYBOOK_FILE="$INFRA_PATH/ansible/local/playbooks/stop/metagraph-l0/cluster.ansible.yml"
    export ANSIBLE_LOCAL_CURRENCY_L1_START_PLAYBOOK_FILE="$INFRA_PATH/ansible/local/playbooks/start/currency-l1/cluster.ansible.yml"
    export ANSIBLE_LOCAL_CURRENCY_L1_STOP_PLAYBOOK_FILE="$INFRA_PATH/ansible/local/playbooks/stop/currency-l1/cluster.ansible.yml"
    export ANSIBLE_LOCAL_DATA_L1_START_PLAYBOOK_FILE="$INFRA_PATH/ansible/local/playbooks/start/data-l1/cluster.ansible.yml"
    export ANSIBLE_LOCAL_DATA_L1_STOP_PLAYBOOK_FILE="$INFRA_PATH/ansible/local/playbooks/stop/data-l1/cluster.ansible.yml"
    
    ## Colors
    export OUTPUT_RED=$(tput setaf 1)
    export OUTPUT_GREEN=$(tput setaf 2)
    export OUTPUT_YELLOW=$(tput setaf 3)
    export OUTPUT_CYAN=$(tput setaf 6)
    export OUTPUT_WHITE=$(tput setaf 7)
}

function get_tessellation_version_name() {
    local input="$1"
    if [[ "$TESSELLATION_VERSION_IS_TAG_OR_BRANCH" == "branch" ]]; then
        # Remove special characters
        local cleaned=$(echo "$input" | tr -cd '[:alnum:][:space:]')
        # Convert to lowercase
        cleaned=$(echo "$cleaned" | tr '[:upper:]' '[:lower:]')
        # Replace spaces with underscores
        cleaned=$(echo "$cleaned" | tr ' ' '_')
        echo "$cleaned"
    else
        echo "$input"
    fi
}

function get_tessellation_version_semver() {
    local input="$1"
    if [[ "$TESSELLATION_VERSION_IS_TAG_OR_BRANCH" == "branch" ]]; then
        #Mocked version when it's a branch
        echo "99.99.99"
    else
        echo "$input"
    fi
}

function get_metagraph_id_from_metagraph_l0_genesis() {
    for ((i = 1; i <= 51; i++)); do
        METAGRAPH_ID=$(cat $SOURCE_PATH/metagraph-l0/genesis/genesis.address)
        if [[ -z "$METAGRAPH_ID" ]]; then
            if [ $i -eq 50 ]; then
                echo_red "Could not find the metagraph_id"
                exit 1
            fi
            echo_white "metagraph_id not found trying again in 5s"
            sleep 5
        else
            echo_url "METAGRAPH_ID: " $METAGRAPH_ID
            echo_white "Filling the euclid.json file"
            contents="$(jq --arg METAGRAPH_ID "$METAGRAPH_ID" '.metagraph_id = $METAGRAPH_ID' $ROOT_PATH/euclid.json)" &&
                echo -E "${contents}" >$ROOT_PATH/euclid.json

            get_env_variables_from_json_config_file
            break
        fi
    done
}

function get_checkout_tessellation_version() {
    local version=$1
    local semver_regex='^([0-9]+)\.([0-9]+)\.([0-9]+)(-([0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*))?(\+([0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*))?$'
    if [[ $version =~ $semver_regex ]]; then
        echo "v$version"
    else
        echo "$version"
    fi
}

function get_should_use_updated_modules() {
    local version=$1
    if [[ "$(printf "%s\n%s" "$version" "2.3.0" | sort -V | tail -n1)" == "$version" ]]; then
        echo true
    else
        echo false
    fi
}
