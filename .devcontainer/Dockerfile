FROM ubuntu:22.04

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
RUN apt-get update && \
    apt-get install -y apt-transport-https ca-certificates curl software-properties-common lsb-release && \
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add - && \
    add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" && \
    apt-get update && \
    apt-get install -y docker-ce-cli

# Install Docker Compose
RUN curl -L "https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && \
    chmod +x /usr/local/bin/docker-compose

# Install Coursier
RUN curl -fL https://github.com/coursier/coursier/releases/download/v2.1.9/cs-x86_64-pc-linux.gz | gzip -d > cs && \
    chmod +x cs && \
    mv cs /usr/local/bin/cs

# Install Scala using Coursier
RUN cs install cs && \
    cs setup --yes --apps scala:2.13.14

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
ENV NODE_VERSION v20.12.2
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
RUN /bin/bash -c "source $NVM_DIR/nvm.sh && nvm install $NODE_VERSION && nvm use --delete-prefix $NODE_VERSION"
# Add node and npm to the PATH
ENV NODE_PATH $NVM_DIR/versions/node/$NODE_VERSION/bin
ENV PATH $NODE_PATH:$PATH

# Install yarn
RUN npm install -g yarn

# Install yq
ENV YQ_VERSION=v4.43.1
ENV YQ_BINARY=yq_linux_amd64
RUN wget https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/${YQ_BINARY}.tar.gz -O - | \
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
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v1.1.5/zsh-in-docker.sh)" -- \
    -p git \
    -p ssh-agent \
    -p https://github.com/zsh-users/zsh-autosuggestions \
    -p https://github.com/zsh-users/zsh-completions
