#!/bin/bash
set -e

docker compose run --rm -T lint || (echo "❌ Lint failed!" && exit 1)

# Build only if needed (when called from pre-push hook)
if [ "$DOCKER_BUILD_NEEDED" = "1" ]; then
    docker compose build test-coverage
    if [ $? -eq 0 ] && [ -n "$DOCKER_BUILD_CHECKSUM_FILE" ]; then
        echo "$DOCKER_BUILD_CHECKSUM" > "$DOCKER_BUILD_CHECKSUM_FILE"
    fi
elif [ -z "$DOCKER_BUILD_NEEDED" ]; then
    docker compose build test-coverage
fi

docker compose run --rm -T test-coverage

docker compose build

echo "✅ All checks passed!"
