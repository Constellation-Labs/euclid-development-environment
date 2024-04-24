function migrate_v_0_9_0() {
  local genesis_file_name=$(jq '.p12_files.genesis.file_name' $ROOT_PATH/euclid.json)
  local genesis_alias=$(jq '.p12_files.genesis.alias' $ROOT_PATH/euclid.json)
  local genesis_password=$(jq '.p12_files.genesis.password' $ROOT_PATH/euclid.json)
  local validator_1_file_name=$(jq '.p12_files.validators[0].file_name' $ROOT_PATH/euclid.json)
  local validator_1_alias=$(jq '.p12_files.validators[0].alias' $ROOT_PATH/euclid.json)
  local validator_1_password=$(jq '.p12_files.validators[0].password' $ROOT_PATH/euclid.json)
  local validator_2_file_name=$(jq '.p12_files.validators[1].file_name' $ROOT_PATH/euclid.json)
  local validator_2_alias=$(jq '.p12_files.validators[1].alias' $ROOT_PATH/euclid.json)
  local validator_2_password=$(jq '.p12_files.validators[1].password' $ROOT_PATH/euclid.json)
  local layers=$(jq '.docker.default_containers' $ROOT_PATH/euclid.json)
  if [[ $layers == *"monitoring"* ]]; then
    start_monitoring=true
  else
    start_monitoring=false
  fi

  jq '.version = "0.9.0" | del(.metagraph_id)' $ROOT_PATH/euclid.json >$ROOT_PATH/temp.json && mv $ROOT_PATH/temp.json $ROOT_PATH/euclid.json
  jq ".layers = $layers | del(.p12_files)" $ROOT_PATH/euclid.json >$ROOT_PATH/temp.json && mv $ROOT_PATH/temp.json $ROOT_PATH/euclid.json
  jq ".docker.start_monitoring_container = $start_monitoring | del(.docker.default_containers)" $ROOT_PATH/euclid.json >$ROOT_PATH/temp.json && mv $ROOT_PATH/temp.json $ROOT_PATH/euclid.json
  jq ". + {  \"nodes\": [
    {
      \"name\": \"metagraph-node-1\",
      \"key_file\": {
        \"name\": $genesis_file_name,
        \"alias\": $genesis_alias,
        \"password\": $genesis_password
      }
    },
    {
      \"name\": \"metagraph-node-2\",
      \"key_file\": {
        \"name\": $validator_1_file_name,
        \"alias\": $validator_1_alias,
        \"password\": $validator_1_password
      }
    },
    {
      \"name\": \"metagraph-node-3\",
      \"key_file\": {
        \"name\": $validator_2_file_name,
        \"alias\": $validator_2_alias,
        \"password\": $validator_2_password
      }
    }
  ]}" $ROOT_PATH/euclid.json >$ROOT_PATH/temp.json && mv $ROOT_PATH/temp.json $ROOT_PATH/euclid.json
}
