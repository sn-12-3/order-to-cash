# Stage 1: Build stage with MQ client
FROM --platform=linux/amd64 icr.io/ibm-messaging/mq:latest as mq-base

# Stage 2: Node.js application
FROM --platform=linux/amd64 node:20-slim

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy MQ client libraries from MQ image
COPY --from=mq-base /opt/mqm /opt/mqm

# Set MQ environment variables
ENV MQ_INSTALLATION_PATH=/opt/mqm
ENV LD_LIBRARY_PATH=/opt/mqm/lib64:/opt/mqm/lib:$LD_LIBRARY_PATH
ENV PATH=/opt/mqm/bin:$PATH

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port if needed (optional)
EXPOSE 3000

# Run the application
CMD ["node", "index.js"]

# Made with Bob