FROM node:22-alpine

# Install bash and curl for Bun installer
RUN apk add --no-cache bash curl

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash && \
    ln -s /root/.bun/bin/bun /root/.bun/bin/bunx

ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /workspace

# Keep container alive for exec commands
CMD ["tail", "-f", "/dev/null"]
