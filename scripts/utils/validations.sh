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
        echo_red "Ansible is not installed. Please install Ansible before running this command"
        exit 1
    fi

    echo_white "Checking if host configuration is valid..."
    cd ..

    while IFS= read -r line; do
        if [[ "$line" =~ ^[[:space:]]+ansible_host: ]]; then
            ansible_host=$(echo "$line" | awk '{print $NF}')
            if ! check_ip "$ansible_host"; then
                echo_red "Your hosts IPs are invalid or empty, please update $ANSIBLE_HOSTS_FILE file"
                exit 1
            fi
        fi
    done <"$ANSIBLE_HOSTS_FILE"
    echo_green "Hosts are valid"
}

function check_p12_files() {
    echo_white "All 3 P12 files should be inserted on source/p12-files directory"
    if [ ! -f "$SOURCE_PATH/p12-files/$P12_GENESIS_FILE_NAME" ]; then
        echo_red "File does not exists"
        exit 1
    fi

    if [ ! -f "$SOURCE_PATH/p12-files/$P12_NODE_2_FILE_NAME" ]; then
        echo_red "File does not exists"
        exit 1
    fi

    if [ ! -f "$SOURCE_PATH/p12-files/$P12_NODE_3_FILE_NAME" ]; then
        echo_red "File does not exists"
        exit 1
    fi
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
    PROJECT_TESSELLATION_VERSION=$(sed -n 's/.*val tessellation = "\(.*\)".*/\1/p' $SOURCE_PATH/project/$PROJECT_NAME/project/Dependencies.scala)
    echo_white "Project tessellation version: $PROJECT_TESSELLATION_VERSION"
    echo_white "Tessellation version provided on euclid.json: $TESSELLATION_VERSION"
    if [[ "$PROJECT_TESSELLATION_VERSION" != "$TESSELLATION_VERSION" ]]; then
        echo_red "Your custom project contains a different version of tessellation than provided on euclid.json. Please use the same version!"
        exit 1
    fi
}

function check_if_tessellation_version_starts_with_v() {
    if [[ $TESSELLATION_VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo_red "euclid.json tessellation_version incorrectly includes a “v” prefix. Please remove this prefix and try again."
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
