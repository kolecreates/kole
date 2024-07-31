# Use a Rust base image with cross-compilation support
FROM rust:1.68 as builder

# Install cross-compilation tools
RUN apt-get update && apt-get install -y \
    gcc-aarch64-linux-gnu \
    g++-aarch64-linux-gnu \
    libc6-dev-arm64-cross

# Set the target architecture
ENV CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc \
    CC_aarch64_unknown_linux_gnu=aarch64-linux-gnu-gcc \
    CXX_aarch64_unknown_linux_gnu=aarch64-linux-gnu-g++

# Set the working directory
WORKDIR /usr/src/hello-world

# Copy the Cargo.toml and Cargo.lock files
COPY Cargo.toml Cargo.lock ./

# Copy the source code
COPY src ./src

# Build the application for ARM64
RUN rustup target add aarch64-unknown-linux-gnu
RUN cargo build --release --target aarch64-unknown-linux-gnu

# Create a directory to store the built binary
RUN mkdir -p /output

# Set the output directory as a volume
VOLUME /output

# Use a minimal Alpine Linux image for the final stage
FROM alpine:latest

# Copy the built binary from the builder stage
COPY --from=builder /usr/src/hello-world/target/aarch64-unknown-linux-gnu/release/hello-world /hello-world

# Create an entrypoint script to copy the binary at runtime and then run it
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'cp /hello-world /output/' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Set the entrypoint to run our script when the container starts
ENTRYPOINT ["/entrypoint.sh"]

# The built binary will be copied to the /output directory when the container is run