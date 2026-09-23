# Single-container deploy (Hugging Face Spaces): FastAPI serves the API, WebSocket and
# built frontend on one port, and the simulator streams telemetry into it.

FROM node:20-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
RUN useradd -m -u 1000 user
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY --chown=user data/ data/
COPY --chown=user backend/ backend/
COPY --chown=user simulator/ simulator/
COPY --chown=user deploy/start.sh deploy/start.sh
COPY --from=web --chown=user /web/dist frontend/dist
USER user
# Train models and seed the DB at build time so the container starts fast.
RUN cd backend && python train.py && python seed.py
ENV PORT=7860
EXPOSE 7860
CMD ["sh", "deploy/start.sh"]
