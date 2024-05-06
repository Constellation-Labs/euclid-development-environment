#!/usr/bin/env bash

function add_ssh_key_to_agent() {
  echo_white "Adding ssh keys to ssh-agent..."
  eval $(ssh-agent -s)
  while IFS= read -r node; do
    ssh_private_key_file=$(jq -r '.ansible_ssh_private_key_file' <<<"$node")
    ssh_private_key_password=$(jq -r '.ansible_ssh_private_key_password' <<<"$node")

    decrypted_ssh_private_key_file="${ssh_private_key_file%.pem}.decrypt.pem"
    openssl rsa -in $ssh_private_key_file -out $decrypted_ssh_private_key_file -passin pass:$ssh_private_key_password &>/dev/null

    ssh-add $decrypted_ssh_private_key_file &>/dev/null
  done < <(yq eval -o=j $ANSIBLE_HOSTS_FILE | jq -cr ".$1.hosts[]")
  echo_green "ssh keys added to ssh-agent"
}

function remove_ssh_key_from_agent() {
  echo_white "Removing ssh keys from ssh-agent..."
  while IFS= read -r node; do
    ssh_private_key_file=$(jq -r '.ansible_ssh_private_key_file' <<<"$node")
    ssh_private_key_password=$(jq -r '.ansible_ssh_private_key_password' <<<"$node")

    decrypted_ssh_private_key_file="${ssh_private_key_file%.pem}.decrypt.pem"
    rm -rf $decrypted_ssh_private_key_file &>/dev/null
    ssh-add -D &>/dev/null
  done < <(yq eval -o=j $ANSIBLE_HOSTS_FILE | jq -cr ".$1.hosts[]")
  echo_green "ssh keys removed from ssh-agent"
}
