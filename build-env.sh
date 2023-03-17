#!/bin/bash

if [ -z "$1" ]
then
  echo "You should provide the GITHUB_PERSONAL_TOKEN"
else
  docker-compose build --build-arg GIT_PERSONAL_ACCESS_TOKEN=$1
  docker-compose up -d

  docker exec -it l1-currency-2 curl -v -X POST http://localhost:9002/cluster/join -H "Content-type: application/json" -d '{ "id":"b1cf4d017eedb3e187b4d17cef9bdbcfdb2e57b26e346e9186da3a7a2b9110d73481fedbc6de23db51fb932371c54b02fff3388712dcb1e902870da7fa472f66", "ip": "172.50.0.4", "p2pPort": 9001 }'
  docker exec -it l1-currency-3 curl -v -X POST http://localhost:9002/cluster/join -H "Content-type: application/json" -d '{ "id":"b1cf4d017eedb3e187b4d17cef9bdbcfdb2e57b26e346e9186da3a7a2b9110d73481fedbc6de23db51fb932371c54b02fff3388712dcb1e902870da7fa472f66", "ip": "172.50.0.4", "p2pPort": 9001 }'
fi