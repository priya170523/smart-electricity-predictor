FROM node:22-bookworm-slim

# Install Python for the machine-learning model
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Set the project directory
WORKDIR /app

# Install backend dependencies
COPY server/package.json server/package-lock.json ./server/

RUN cd server && npm ci --omit=dev

# Install Python dependencies in the path expected by server.js
COPY ml/requirements.txt ./ml/requirements.txt

RUN python3 -m venv /app/ml/venv \
    && /app/ml/venv/bin/python -m pip install --upgrade pip \
    && /app/ml/venv/bin/python -m pip install -r /app/ml/requirements.txt

# Copy the backend and ML files
COPY server/ ./server/
COPY ml/ ./ml/

# Configure production mode
ENV NODE_ENV=production

# Render supplies the PORT environment variable
EXPOSE 5001

CMD ["node", "server/server.js"]
