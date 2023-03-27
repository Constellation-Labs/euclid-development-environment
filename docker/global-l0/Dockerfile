FROM ubuntu-with-java-and-sbt

ARG GIT_PERSONAL_ACCESS_TOKEN
ARG P12_FILE_NAME
ARG P12_FILE_KEY_ALIAS
ARG P12_FILE_PASSWORD

ENV LC_ALL C.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US.UTF-8

ENV GITHUB_TOKEN=${GIT_PERSONAL_ACCESS_TOKEN}
ENV CL_KEYSTORE=${P12_FILE_NAME}
ENV CL_KEYALIAS=${P12_FILE_KEY_ALIAS}
ENV CL_PASSWORD=${P12_FILE_PASSWORD}

RUN mkdir codebase

COPY global-l0/tessellation codebase/tessellation
COPY p12_files/${P12_FILE_NAME} ${P12_FILE_NAME}

RUN cd codebase/tessellation  && \
    sbt core/assembly keytool/assembly wallet/assembly

RUN mv codebase/tessellation/modules/core/target/scala-2.13/tessellation-core-assembly-* global-l0.jar && \
    mv codebase/tessellation/modules/keytool/target/scala-2.13/tessellation-keytool-assembly-* cl-keytool.jar && \
    mv codebase/tessellation/modules/wallet/target/scala-2.13/tessellation-wallet-assembly-* cl-wallet.jar