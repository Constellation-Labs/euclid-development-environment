#!/usr/bin/env bash

function check_ip() {
    local ip="$1"
    # Regular expression to match IPv4 address
    local ip_regex='^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$'
    if [[ $ip =~ $ip_regex ]]; then
        return 0
    else
        return 1
    fi
}

function check_ansible() {
    echo_white "Checking if Ansible is installed..."

    if command -v ansible &>/dev/null; then
        echo_green "Ansible is installed."
    else
        echo_red "Ansible is not installed. Please install Ansible > 2.16 before running this command"
        exit 1
    fi

    ansible_version=$(ansible --version 2>/dev/null | head -n 1 | sed -E 's/.*([0-9]+\.[0-9]+\.[0-9]+).*/\1/')
    min_version="2.16"

    echo_white "Checking if Ansible version is greater than $min_version"
    version_comparison=$(echo -e "$ansible_version\n$min_version" | sort -V | head -n1)
    if [[ "$version_comparison" != "$min_version" ]]; then
        echo_red "Ansible version is less than $min_version. Be sure to update your ansible to a version greater then $min_version"
        exit 1
    else
        echo_green "Ansible is greater than $min_version"
    fi
}

function check_nodes_host_file() {
    echo_white "Checking if nodes hosts configuration is valid..."
    while IFS= read -r node; do
        ansible_host=$(jq -r '.ansible_host' <<<"$node")
        ssh_private_key_file=$(jq -r '.ansible_ssh_private_key_file' <<<"$node")
        if ! check_ip "$ansible_host"; then
            echo_red "Your nodes hosts IPs are invalid or empty, please update $ANSIBLE_HOSTS_FILE file"
            exit 1
        fi
        if [ ! -f "$ssh_private_key_file" ]; then
            echo "Error: The file '$ssh_private_key_file' does not exist."
            exit 1
        fi

        finger_print=$(ssh-keygen -lf $ssh_private_key_file | awk '{print $2}')
        if [ $? -ne 0 ]; then
            echo_yellow "Could not get finger-print of SSH Key file, be sure to add this file to ssh-agent"
            echo_yellow "To add to the agent you need to run:"
            echo
            echo_white "eval \$(ssh-agent -s)"
            echo_white "ssh-add $ssh_private_key_file"
            echo
            echo_yellow "If your file contains a password, you might need to install the library ssh-askpass if you don't have installed already"
            echo_yellow "#################################"
        elif ! ssh-add -l | grep -q $finger_print >/dev/null 2>&1; then
            echo_red "#################################"
            echo_red "The ssh_key is not added to the SSH agent, please add to the agent before process."
            echo_red "To add to the agent you need to run:"
            echo
            echo_white "eval \$(ssh-agent -s) # Run this command only once. If you have multiple files, do not run this command again as it will reset the agent."
            echo_white "ssh-add $ssh_private_key_file"
            echo
            echo_yellow "If your file contains a password, you might need to install the library ssh-askpass if you don't have installed already"
            echo_red "#################################"
            exit 1
        fi
    done < <(yq eval -o=j $ANSIBLE_HOSTS_FILE | jq -cr '.nodes.hosts[]')
}

function check_monitoring_host_file() {
    echo_white "Checking if monitoring host configuration is valid..."
    while IFS= read -r node; do
        ansible_host=$(jq -r '.ansible_host' <<<"$node")
        ssh_private_key_file=$(jq -r '.ansible_ssh_private_key_file' <<<"$node")
        if ! check_ip "$ansible_host"; then
            echo_red "Your monitoring hosts IPs are invalid or empty, please update $ANSIBLE_HOSTS_FILE file"
            exit 1
        fi

        if [ ! -f "$ssh_private_key_file" ]; then
            echo "Error: The file '$ssh_private_key_file' does not exist."
            exit 1
        fi

        finger_print=$(ssh-keygen -lf $ssh_private_key_file | awk '{print $2}')
        if [ $? -ne 0 ]; then
            echo_yellow "Could not get finger-print of SSH Key file, be sure to add this file to ssh-agent"
            echo_yellow "To add to the agent you need to run:"
            echo
            echo_white "eval \$(ssh-agent -s)"
            echo_white "ssh-add $ssh_private_key_file"
            echo
            echo_yellow "If your file contains a password, you might need to install the library ssh-askpass if you don't have installed already"
            echo_yellow "#################################"
        elif ! ssh-add -l | grep -q $finger_print >/dev/null 2>&1; then
            echo_red "#################################"
            echo_red "The ssh_key is not added to the SSH agent, please add to the agent before process."
            echo_red "To add to the agent you need to run:"
            echo
            echo_white "eval \$(ssh-agent -s)"
            echo_white "ssh-add $ssh_private_key_file"
            echo
            echo_yellow "If your file contains a password, you might need to install the library ssh-askpass if you don't have installed already"
            echo_red "#################################"
            exit 1
        fi
    done < <(yq eval -o=j $ANSIBLE_HOSTS_FILE | jq -cr '.monitoring.hosts[]')
}

function check_network() {
    local network="$1"
    case "$network" in
    "integrationnet" | "mainnet")
        echo "Valid network: $network"
        ;;
    *)
        echo "Invalid network: $network"
        exit 1
        ;;
    esac
}

function check_if_tessellation_version_of_project_matches_euclid_json() {
    echo
    echo_yellow "Checking the project tessellation version and tessellation version provided on euclid.json"

    PROJECT_TESSELLATION_VERSION=$(sed -n 's/.*val tessellation = "\(.*\)".*/\1/p' "$SOURCE_PATH/project/$PROJECT_NAME/project/Dependencies.scala")

    if [[ "$TESSELLATION_VERSION_IS_TAG_OR_BRANCH" == "branch" ]]; then
        if [[ "$PROJECT_TESSELLATION_VERSION" != "99.99.99" ]]; then
            echo_red "You're running using tessellation branch as base. Please update your Dependencies.scala file tessellation version to 99.99.99"
            exit 1
        fi
    else
        echo_white "Project tessellation version: $PROJECT_TESSELLATION_VERSION"
        echo_white "Tessellation version provided on euclid.json: $TESSELLATION_VERSION"
        if [[ "$PROJECT_TESSELLATION_VERSION" != "$TESSELLATION_VERSION" ]]; then
            echo_red "Your custom project contains a different version of tessellation than provided on euclid.json. Please use the same version!"
            exit 1
        fi
    fi
}

function check_if_tessellation_version_starts_with_v() {
    if [[ $TESSELLATION_VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo_red "euclid.json tessellation_version incorrectly includes a “v” prefix. Please remove this prefix and try again."
        exit 1
    fi
}

function check_if_github_token_was_provided() {
    if [[ -z "$GITHUB_TOKEN" ]]; then
        echo_red "You should provide the GITHUB_TOKEN on euclid.json file"
        exit 1
    fi
}

function check_if_package_is_installed() {
    if [[ -z "$(which $1 | grep "/")" ]]; then
        echo_red "Could not find package $1, please install this package first"
        exit 1
    fi
}

function check_if_config_file_is_the_new_format() {
    if [[ ! -f "$ROOT_PATH/euclid.json" ]]; then
        echo_red "In version 0.4.0, Euclid environment variables were migrated to a JSON format in $ROOT_PATH/euclid.json. You will need to manually migrate your variables in .env to $ROOT_PATH/euclid.json"
        exit 1
    fi
}

function check_if_github_token_is_valid() {
    if curl -s -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user | grep -q "Bad credentials"; then
        echo_red "Invalid GITHUB_TOKEN"
        exit 1
    fi
}

function check_p12_files() {
    echo
    echo_white "Checking the p12 files..."
    echo
    while IFS= read -r node; do
        name=$(jq -r '.key_file.name' <<<"$node")
        echo_yellow "Checking if the file: $name exists..."

        if [ ! -f "$SOURCE_PATH/p12-files/$name" ]; then
            echo_red "File does not exists"
            exit 1
        fi

        echo_green "File exists"
        echo
    done < <(jq -c '.[]' <<<"$NODES")
}

function check_if_we_have_at_least_3_nodes() {
    nodes_number=$(echo "$NODES" | jq length)
    if ((nodes_number < 3)); then
        echo_red "You should provide at least 3 nodes in euclid.json"
        exit 1
    fi
}

function check_if_genesis_files_exists() {
    if [[ ! -f "$INFRA_PATH/docker/shared/genesis/genesis.address" ]]; then
        echo_red "Could not get metagraph information, be sure that genesis files exists on infra/docker/shared/genesis"
        exit 1
    fi
}

function check_metagraph_owner_fees_file_exists() {
    if [ "$#" -eq 0 ]; then
        return
    fi
    local owner_file_path=$SOURCE_PATH/p12-files/$1
    if [ -f "$owner_file_path" ]; then
        if [[ "$owner_file_path" == *.p12 ]]; then
            echo_green "Owner file exists"
        else
            echo_red "Invalid owner file extension, it should be .p12"
            exit 1
        fi
    else
        echo_red "Owner file does not exist."
        exit 1
    fi
}

function check_metagraph_staking_fees_file_exists() {
    if [ "$#" -eq 0 ]; then
        return
    fi
    local staking_file_path=$SOURCE_PATH/p12-files/$1
    if [ -f "$staking_file_path" ]; then
        if [[ "$staking_file_path" == *.p12 ]]; then
            echo_green "Staking file exists"
        else
            echo_red "Invalid staking file extension, it should be .p12"
            exit 1
        fi
    else
        echo_red "Staking file does not exist."
        exit 1
    fi
}

function check_metagraph_owner_fees_information() {
    if [ "$#" -eq 0 ]; then
        return
    elif [ "$#" -ne 3 ]; then
        echo_red "You should provide all 3 parameters to owner wallet validation"
        exit 1
    fi
}

function check_metagraph_staking_fees_information() {
    if [ "$#" -eq 0 ]; then
        return
    elif [ "$#" -ne 3 ]; then
        echo_red "You should provide all 3 parameters to staking wallet validation"
        exit 1
    fi
}

function check_if_owner_and_staking_address_are_equal() {
    if [[ "$SNAPSHOT_FEES_OWNER_FILE_NAME" == "$SNAPSHOT_FEES_STAKING_FILE_NAME" ]]; then
        echo_red "Owner and Staking address should be different"
        exit 1
    fi
}

function check_git_ref_exists() {
    local ref=$1
    local repo_url="https://github.com/Constellation-Labs/tessellation.git"
    if [[ "$TESSELLATION_VERSION_IS_TAG_OR_BRANCH" == "branch" ]]; then
        echo_white "Checking if branch exists..."
        if git ls-remote --exit-code --heads "$repo_url" "$ref" >/dev/null; then
            echo_green "Branch '$ref' exists."
            echo
        else
            echo_red "Branch '$ref' not exists."
            exit 1
        fi
    else
        echo_white "Checking if tag exists..."
        if git ls-remote --exit-code --tags "$repo_url" "v$ref" >/dev/null; then
            echo_green "Tag '$ref' exists."
            echo
        else
            echo_red "Tag '$ref' not exists."
            exit 1
        fi
    fi
}

function confirm_force_genesis() {
    if [[ -z "$argc_force_genesis" ]]; then
        return
    fi
    echo_yellow "This operation will delete your metagraph and snapshots"
    read -p "Do you want to continue? (Y/y to confirm): " -r response

    echo_white ""
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Aborting"
        exit 1
    fi
}
