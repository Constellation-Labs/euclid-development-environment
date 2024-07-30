#!/usr/bin/env bash
function destroy_containers() {
    echo_title "################################## DESTROY ##################################"
    echo_white "Starting destroying containers ..."
    
    export ANSIBLE_LOCALHOST_WARNING=False
    export ANSIBLE_INVENTORY_UNPARSED_WARNING=False
    
    NODES_JSON=$(echo "$NODES" | jq -c '.')
    
    ansible-playbook -e "nodes=${NODES_JSON}" -e "infra_path=${INFRA_PATH}" $ANSIBLE_LOCAL_CONTAINERS_DESTROY_PLAYBOOK_FILE
    
}
