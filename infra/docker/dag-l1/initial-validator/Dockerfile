FROM ubuntu-with-java-and-sbt

ARG GIT_PERSONAL_ACCESS_TOKEN
ARG P12_FILE_NAME_GENESIS
ARG P12_FILE_KEY_ALIAS_GENESIS
ARG P12_FILE_PASSWORD_GENESIS
ARG TESSELLATION_VERSION

ENV LC_ALL C.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US.UTF-8

ENV GITHUB_TOKEN=${GIT_PERSONAL_ACCESS_TOKEN}
ENV CL_KEYSTORE=${P12_FILE_NAME_GENESIS}
ENV CL_KEYALIAS=${P12_FILE_KEY_ALIAS_GENESIS}
ENV CL_PASSWORD=${P12_FILE_PASSWORD_GENESIS}

COPY p12-files/${P12_FILE_NAME_GENESIS} ${P12_FILE_NAME_GENESIS}

RUN apt-get install wget -y && \
    echo "Getting dag-l1 jar ..." && \
    wget -q https://github.com/Constellation-Labs/tessellation/releases/download/$TESSELLATION_VERSION/cl-dag-l1.jar  && \
    mv cl-dag-l1.jar dag-l1.jar && \
    echo "Getting cl-wallet jar ..." && \
    wget -q https://github.com/Constellation-Labs/tessellation/releases/download/$TESSELLATION_VERSION/cl-wallet.jar