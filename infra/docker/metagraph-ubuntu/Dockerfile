FROM ubuntu:20.04

WORKDIR /code

ARG GIT_PERSONAL_ACCESS_TOKEN
ARG CHECKOUT_TESSELLATION_VERSION
ARG TESSELLATION_VERSION_IS_TAG_OR_BRANCH

ENV LC_ALL=C.UTF-8 \
    LANG=en_US.UTF-8 \
    LANGUAGE=en_US.UTF-8 \
    GITHUB_TOKEN=${GIT_PERSONAL_ACCESS_TOKEN} \
    DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      openjdk-11-jdk curl gnupg lsof ca-certificates git && \
    echo "deb https://repo.scala-sbt.org/scalasbt/debian all main" | tee /etc/apt/sources.list.d/sbt.list && \
    echo "deb https://repo.scala-sbt.org/scalasbt/debian /" | tee /etc/apt/sources.list.d/sbt_old.list && \
    curl -sL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x2EE0EA64E40A89B84B2DF73499E82A75642AC823" | apt-key add - && \
    apt-get update && \
    apt-get install -y sbt && \
    rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    git clone https://github.com/Constellation-Labs/tessellation.git; \
    cd tessellation; \
    git checkout "$CHECKOUT_TESSELLATION_VERSION"; \
    if [ "$TESSELLATION_VERSION_IS_TAG_OR_BRANCH" = "branch" ]; then \
      sbt sdk/publishM2; \
    fi; \
    sbt wallet/assembly dagL1/assembly keytool/assembly dagL0/assembly; \
    mv modules/wallet/target/scala-2.13/tessellation-wallet-assembly-* /code/cl-wallet.jar; \
    mv modules/keytool/target/scala-2.13/tessellation-keytool-assembly-* /code/cl-keytool.jar; \
    mv modules/dag-l1/target/scala-2.13/tessellation-dag-l1-assembly-* /code/dag-l1.jar; \
    mv modules/dag-l0/target/scala-2.13/tessellation-dag-l0-assembly-* /code/global-l0.jar
