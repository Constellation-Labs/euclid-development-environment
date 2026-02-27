#!/usr/bin/env bash
function destroy_containers() {
    echo_title "################################## DESTROY ##################################"
    echo_white "Starting destroying containers ..."

    export ANSIBLE_LOCALHOST_WARNING=False
    export ANSIBLE_INVENTORY_UNPARSED_WARNING=False

    ansible-playbook $ANSIBLE_LOCAL_CONTAINERS_DESTROY_PLAYBOOK_FILE

}
