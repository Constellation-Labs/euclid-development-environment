FROM ubuntu-with-java-and-sbt

ARG GIT_PERSONAL_ACCESS_TOKEN

ENV LC_ALL C.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US.UTF-8

ENV GITHUB_TOKEN=${GIT_PERSONAL_ACCESS_TOKEN}
RUN git clone https://github.com/Constellation-Labs/tessellation.git && \
    cd tessellation && \
    git checkout develop && \
    sbt clean core/assembly currencyL0/assembly currencyL1/assembly

RUN mv tessellation/modules/core/target/scala-2.13/tessellation-core-assembly-* global-l0.jar && \
    mv tessellation/modules/currency-l0/target/scala-2.13/tessellation-currency-l0-assembly-* currency-l0.jar && \
    mv tessellation/modules/currency-l1/target/scala-2.13/tessellation-currency-l1-assembly-* currency-l1.jar && \
    touch genesis.csv

RUN rm -r tessellation/