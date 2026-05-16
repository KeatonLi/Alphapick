#!/bin/bash
cd /home/libokai/programs/QuantForge/QuantForge/backend
export QUANTFORGE_DB_HOST=111.231.107.210
export QUANTFORGE_DB_PORT=13306
export QUANTFORGE_DB_USER=QuantForge
export QUANTFORGE_DB_PASSWORD=QuantForgeSQL
export QUANTFORGE_DB_NAME=quantforge
export QUANTFORGE_PORT=8084
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8084
