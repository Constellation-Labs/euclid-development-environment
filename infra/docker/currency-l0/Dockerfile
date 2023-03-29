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

COPY currency-l0/l0-currency-template codebase/l0-currency-template
COPY p12-files/${P12_FILE_NAME} ${P12_FILE_NAME}

RUN cd codebase/l0-currency-template  && \
    sbt currencyL0/assembly

RUN mv codebase/l0-currency-template/modules/l0/target/scala-2.13/l0-currency-template-currency-l0-assembly-* currency-l0.jar