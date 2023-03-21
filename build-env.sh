#!/bin/bash

if [ -z "$1" ]
then
  echo "You should provide the GITHUB_PERSONAL_TOKEN"
else
  export DOCKER_BUILDKIT=0

  docker network create --driver=bridge --subnet=172.50.0.0/24 custom-network
  git clone https://github.com/Constellation-Labs/tessellation.git
  cp -r tessellation images/global-l0
  cp -r tessellation images/currency-l0
  cp -r tessellation images/currency-l1/initial-validator
  mv tessellation/ images/currency-l1/validators/

  cd composes/shared || exit
  docker-compose build --build-arg GIT_PERSONAL_ACCESS_TOKEN=$1
  docker-compose up -d
  cd ../../

  cd composes/global-l0 || exit
  docker-compose build --build-arg GIT_PERSONAL_ACCESS_TOKEN=$1
  docker-compose up -d
  cd ../../

  cd composes/currency-l0 || exit
  docker-compose build --build-arg GIT_PERSONAL_ACCESS_TOKEN=$1
  docker-compose up -d
  cd ../../

  cd composes/currency-l1 || exit
  docker-compose build --build-arg GIT_PERSONAL_ACCESS_TOKEN=$1
  docker-compose up -d
  cd ../../

  cd composes/monitoring || exit
  docker-compose build
  docker-compose up -d
  cd ../../

for (( i = 0; i < 10; i++ )); do
  if curl -v http://localhost:9300/metrics && curl -v http://localhost:9400/metrics; then
    echo "Validators booted"
    docker exec -it l1-currency-2 curl -v -X POST http://localhost:9002/cluster/join -H "Content-type: application/json" -d '{ "id":"b1cf4d017eedb3e187b4d17cef9bdbcfdb2e57b26e346e9186da3a7a2b9110d73481fedbc6de23db51fb932371c54b02fff3388712dcb1e902870da7fa472f66", "ip": "172.50.0.4", "p2pPort": 9001 }'
    docker exec -it l1-currency-3 curl -v -X POST http://localhost:9002/cluster/join -H "Content-type: application/json" -d '{ "id":"b1cf4d017eedb3e187b4d17cef9bdbcfdb2e57b26e346e9186da3a7a2b9110d73481fedbc6de23db51fb932371c54b02fff3388712dcb1e902870da7fa472f66", "ip": "172.50.0.4", "p2pPort": 9001 }'
    break
  else
    echo "L1 validators still booting... waiting 30s"
    sleep 30s
  fi;
done
fi