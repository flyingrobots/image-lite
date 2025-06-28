#!/bin/bash
set -e

# Check if package.json has changed
if [ -f .docker-build-hash ]; then
    CURRENT_HASH=$(md5sum package.json 2>/dev/null || md5 -q package.json 2>/dev/null || echo "none")
    STORED_HASH=$(cat .docker-build-hash 2>/dev/null || echo "")
    
    if [ "$CURRENT_HASH" = "$STORED_HASH" ]; then
        exit 0
    else
        docker compose build && echo "$CURRENT_HASH" > .docker-build-hash
    fi
else
    CURRENT_HASH=$(md5sum package.json 2>/dev/null || md5 -q package.json 2>/dev/null || echo "none")
    docker compose build && echo "$CURRENT_HASH" > .docker-build-hash
fi