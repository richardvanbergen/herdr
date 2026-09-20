FROM node:22-bookworm-slim

# Codex needs a Linux CLI environment and access to the project workspace.
RUN apt-get update && apt-get install -y --no-install-recommends bash curl ca-certificates git unzip \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g @openai/codex

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash

ENV PATH="/root/.bun/bin:${PATH}"

RUN mkdir -p /root/.codex

WORKDIR /workspace

# Keep container alive for exec commands
CMD ["tail", "-f", "/dev/null"]
