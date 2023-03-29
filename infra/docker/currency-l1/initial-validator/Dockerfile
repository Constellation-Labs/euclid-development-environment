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

COPY currency-l1/tessellation codebase/tessellation
COPY currency-l1/l1-currency-template codebase/l1-currency-template
COPY p12-files/${P12_FILE_NAME_GENESIS} ${P12_FILE_NAME_GENESIS}

RUN cd codebase/tessellation && \
    sbt wallet/assembly shared/publishM2 kernel/publishM2 keytool/publishM2 sdk/publishM2 dagL1/publishM2 currencyL0/publishM2 currencyL1/publishM2

RUN  mv codebase/tessellation/modules/wallet/target/scala-2.13/tessellation-wallet-assembly-* cl-wallet.jar

RUN cd codebase/l1-currency-template  && \
    sbt currencyL1/assembly

RUN mv codebase/l1-currency-template/modules/l1/target/scala-2.13/l1-currency-template-currency-l1-assembly-* currency-l1.jar