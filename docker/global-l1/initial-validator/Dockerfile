FROM ubuntu-with-java-and-sbt

ARG GIT_PERSONAL_ACCESS_TOKEN
ARG P12_FILE_NAME_GENESIS
ARG P12_FILE_KEY_ALIAS_GENESIS
ARG P12_FILE_PASSWORD_GENESIS

ENV LC_ALL C.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US.UTF-8

ENV GITHUB_TOKEN=${GIT_PERSONAL_ACCESS_TOKEN}
ENV CL_KEYSTORE=${P12_FILE_NAME_GENESIS}
ENV CL_KEYALIAS=${P12_FILE_KEY_ALIAS_GENESIS}
ENV CL_PASSWORD=${P12_FILE_PASSWORD_GENESIS}

RUN mkdir codebase

COPY global-l1/tessellation codebase/tessellation
COPY p12_files/${P12_FILE_NAME_GENESIS} ${P12_FILE_NAME_GENESIS}

RUN cd codebase/tessellation  && \
    git pull && \
    sbt dagL1/assembly wallet/assembly

RUN mv codebase/tessellation/modules/dag-l1/target/scala-2.13/tessellation-dag-l1-assembly-* global-l1.jar && \
    mv codebase/tessellation/modules/wallet/target/scala-2.13/tessellation-wallet-assembly-* cl-wallet.jar