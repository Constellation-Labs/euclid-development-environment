FROM ubuntu:22.04

# Define versions in ARGs for easy updates
ARG DOCKER_COMPOSE_VERSION=v2.27.1 # Check new versions at: https://github.com/docker/compose/releases
ARG COURSIER_VERSION=v2.1.10 # Check new versions at: https://github.com/coursier/coursier/releases and https://github.com/VirtusLab/coursier-m1/releases
ARG SCALA_VERSION=2.13.14 # Check new versions at: https://github.com/scala/scala/releases
ARG NODE_VERSION=v20.14.0 # Check new versions at: https://github.com/nodejs/node/releases
ARG NVM_INSTALL_SCRIPT_VERSION=v0.39.7 # Check new versions at: https://github.com/nvm-sh/nvm/releases
ARG YQ_VERSION=v4.44.1 # Check new versions at: https://github.com/mikefarah/yq/releases
ARG ZSH_IN_DOCKER_VERSION=v1.2.0 # Check new versions at: https://github.com/deluan/zsh-in-docker/releases

# Set by devcontainer.json configuration
ARG ARCH

WORKDIR /home/

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y \
    curl \
    wget \
    tar \
    gzip \
    git \
    gnupg2 \
    jq \
    sudo \
    zsh \
    vim \
    python3-pip \
    build-essential \
    openssl \
    libclang-dev \
    libssl-dev \
    pkg-config \
    libudev-dev

# Install Docker CLI (client only, assuming hosts docker.sock is mounted)
RUN LOWERCASE_ARCH=$(echo ${ARCH} | tr '[:upper:]' '[:lower:]') && \
    apt-get update && \
    apt-get install -y apt-transport-https ca-certificates curl software-properties-common lsb-release && \
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add - && \
    add-apt-repository "deb [arch=${LOWERCASE_ARCH}] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" && \
    apt-get update && \
    apt-get install -y docker-ce-cli

# Install Docker Compose
RUN curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && \
    chmod +x /usr/local/bin/docker-compose

# Install Coursier
RUN if [ "${ARCH}" = "ARM64" ]; then \
        curl -fL "https://github.com/VirtusLab/coursier-m1/releases/download/${COURSIER_VERSION}/cs-aarch64-pc-linux.gz" | gzip -d > cs; \
    else \
        curl -fL "https://github.com/coursier/coursier/releases/download/${COURSIER_VERSION}/cs-x86_64-pc-linux.gz" | gzip -d > cs; \
    fi && \
    chmod +x cs && \
    mv cs /usr/local/bin/cs

# Install Scala using Coursier
RUN cs install cs && \
    cs setup --yes --apps scala:${SCALA_VERSION}

# Install Giter8 using Coursier
RUN cs install giter8

# Install rustup and cargo
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup install stable && \
    rustup default stable

# Install argc
RUN cargo install argc

# Install nvm
RUN mkdir -p /usr/local/nvm
ENV NVM_DIR /usr/local/nvm
# IMPORTANT: set the exact version
ENV NODE_VERSION ${NODE_VERSION}
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_INSTALL_SCRIPT_VERSION}/install.sh | bash
RUN /bin/bash -c "source $NVM_DIR/nvm.sh && nvm install $NODE_VERSION && nvm use --delete-prefix $NODE_VERSION"
# Add node and npm to the PATH
ENV NODE_PATH $NVM_DIR/versions/node/$NODE_VERSION/bin
ENV PATH $NODE_PATH:$PATH

# Install yarn
RUN npm install -g yarn

# Install yq
RUN LOWERCASE_ARCH=$(echo ${ARCH} | tr '[:upper:]' '[:lower:]') && \
    YQ_BINARY=yq_linux_${LOWERCASE_ARCH} && \
    wget https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/${YQ_BINARY}.tar.gz -O - | \
    tar xz && \
    mv ${YQ_BINARY} /usr/bin/yq

# Install ansible
RUN echo 'Etc/UTC' > /etc/timezone && \
    ln -s /usr/share/zoneinfo/Etc/UTC /etc/localtime && \
    apt-get install -y software-properties-common && \
    add-apt-repository -y --update ppa:ansible/ansible && \
    apt-get install -y ansible

# print version
RUN cs version
RUN rustc --version
RUN cargo --version
RUN rustup --version
RUN rustup override list
RUN node --version
RUN npm --version
RUN yarn --version
RUN jq --version
RUN yq --version
RUN ansible --version
RUN git --version

# Installs zsh with some plugins
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \
    -p git \
    -p ssh-agent \
    -p https://github.com/zsh-users/zsh-autosuggestions \
    -p https://github.com/zsh-users/zsh-completions
