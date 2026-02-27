function migrate_v_0_18_0() {
  jq '.version = "0.18.0" |
      del(.github_token)' "$ROOT_PATH/euclid.json" > "$ROOT_PATH/temp.json" && mv "$ROOT_PATH/temp.json" "$ROOT_PATH/euclid.json"

  echo_green "v0.18.0 Updated - Removed github_token"
}
