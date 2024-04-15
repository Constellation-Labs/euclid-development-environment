function migrate_v_0_10_0() {
  jq '.version = "0.10.0" | del(.version)' $ROOT_PATH/euclid.json >$ROOT_PATH/temp.json && mv $ROOT_PATH/temp.json $ROOT_PATH/euclid.json
  jq '.docker.start_grafana_container = .docker.start_monitoring_container | del(.docker.start_monitoring_container)' $ROOT_PATH/euclid.json >$ROOT_PATH/temp.json && mv $ROOT_PATH/temp.json $ROOT_PATH/euclid.json
  jq 'del(.deploy.ansible)' $ROOT_PATH/euclid.json >$ROOT_PATH/temp.json && mv $ROOT_PATH/temp.json $ROOT_PATH/euclid.json
  jq '.deploy += { "ansible": {
      "hosts": "infra/ansible/remote/hosts.ansible.yml",
      "nodes": {
        "playbooks": {
          "deploy": "infra/ansible/remote/nodes/playbooks/deploy/deploy.ansible.yml",
          "start": "infra/ansible/remote/nodes/playbooks/start/start.ansible.yml"
        }
      },
      "monitoring": {
        "playbooks": {
          "deploy": "infra/ansible/remote/monitoring/playbooks/deploy/deploy.ansible.yml",
          "start": "infra/ansible/remote/monitoring/playbooks/start/start.ansible.yml"
        }
      }
    }}' $ROOT_PATH/euclid.json >$ROOT_PATH/temp.json && mv $ROOT_PATH/temp.json $ROOT_PATH/euclid.json
}
