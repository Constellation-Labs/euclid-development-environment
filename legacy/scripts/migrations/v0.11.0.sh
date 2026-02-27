function migrate_v_0_11_0() {
  jq '.version = "0.11.0" |
      . + { 
        "snapshot_fees": {
          "owner": {
            "key_file": {
              "name": "token-key.p12",
              "alias": "token-key",
              "password": "password"
            }
          },
          "staking": {
            "key_file": {
              "name": "token-key-1.p12",
              "alias": "token-key-1",
              "password": "password"
            }
          }
        }
      }' "$ROOT_PATH/euclid.json" > "$ROOT_PATH/temp.json" && mv "$ROOT_PATH/temp.json" "$ROOT_PATH/euclid.json"

  echo_green "Updated"
}
