function migrate_v_0_12_0() {
  jq '.version = "0.12.0" |
      . + { 
        "ref_type": "tag"
      }' "$ROOT_PATH/euclid.json" > "$ROOT_PATH/temp.json" && mv "$ROOT_PATH/temp.json" "$ROOT_PATH/euclid.json"

  echo_green "v0.12.0 Updated"
}
