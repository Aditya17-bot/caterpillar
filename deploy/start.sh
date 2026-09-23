#!/bin/sh
# Backend on $PORT, simulator feeding it with a random hazard scenario every 45 s.
cd /app/backend
uvicorn main:app --host 0.0.0.0 --port "${PORT:-7860}" &
until python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT:-7860}/health')" 2>/dev/null; do sleep 1; done
python /app/simulator/sim.py --url "http://localhost:${PORT:-7860}" --chaos 45 &
wait
