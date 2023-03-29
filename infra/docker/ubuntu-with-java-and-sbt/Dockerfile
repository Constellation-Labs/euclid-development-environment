FROM ubuntu:20.04

WORKDIR "/code"

ARG GIT_PERSONAL_ACCESS_TOKEN
ARG TESSELLATION_VERSION

ENV LC_ALL C.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US.UTF-8

ENV GITHUB_TOKEN=${GIT_PERSONAL_ACCESS_TOKEN}

RUN apt-get update && \
    apt install openjdk-11-jdk -y && \
    apt-get install curl -y && \
    apt-get install gnupg -y && \
    echo "deb https://repo.scala-sbt.org/scalasbt/debian all main" | tee /etc/apt/sources.list.d/sbt.list && \
    echo "deb https://repo.scala-sbt.org/scalasbt/debian /" | tee /etc/apt/sources.list.d/sbt_old.list && \
    curl -sL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x2EE0EA64E40A89B84B2DF73499E82A75642AC823" | apt-key add && \
    apt-get update && \
    apt-get install sbt -y

RUN mkdir codebase

RUN cd codebase/ && \
    git clone https://github.com/Constellation-Labs/tessellation.git && \
    cd tessellation && \
    git checkout $TESSELLATION_VERSION && \
    sbt wallet/assembly shared/publishM2 kernel/publishM2 keytool/publishM2 sdk/publishM2 dagL1/publishM2 currencyL0/publishM2 currencyL1/publishM2

RUN mv codebase/tessellation/modules/wallet/target/scala-2.13/tessellation-wallet-assembly-* cl-wallet.jar
