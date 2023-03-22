FROM ubuntu-with-java-and-sbt

ARG GIT_PERSONAL_ACCESS_TOKEN

ENV LC_ALL C.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US.UTF-8

ENV GITHUB_TOKEN=${GIT_PERSONAL_ACCESS_TOKEN}

RUN mkdir codebase

COPY currency-l1/tessellation codebase/tessellation

RUN cd codebase/tessellation  && \
    git pull && \
    git checkout develop && \
    sbt clean currencyL1/assembly

RUN mv codebase/tessellation/modules/currency-l1/target/scala-2.13/tessellation-currency-l1-assembly-* currency-l1.jar