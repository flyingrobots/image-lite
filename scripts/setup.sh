#!/bin/bash
set -e

echo "image-lite: setup..."
echo ""

# Check Docker installation
if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is required for local dev from https://www.docker.com/"
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "❌ Docker Compose is not available!"
    echo "Please ensure you have Docker Compose v2"
    exit 1
else
    echo "✅ Docker Compose is available"
fi

echo ""
echo "2️⃣ Creating required directories..."
mkdir -p original optimized coverage
echo "✅ Directories created"

echo ""
echo "3️⃣ Configuring Git hooks..."
git config core.hooksPath .githooks
echo "✅ Git hooks configured"

echo ""
echo "4️⃣ Building Docker images..."
npm run docker:build

echo ""
echo "5️⃣ Creating example configuration..."
if [ ! -f .imagerc ]; then
    cat > .imagerc << 'EOF'
{
  "outputDir": "optimized",
  "formats": ["webp", "avif"],
  "quality": {
    "webp": 85,
    "avif": 80,
    "jpg": 85
  },
  "generateThumbnails": true,
  "thumbnailWidth": 300
}
EOF
    echo "✅ Created .imagerc with default settings"
else
    echo "✅ .imagerc already exists"
fi

echo ""
echo "✨ Setup complete! You're ready to optimize images."
echo ""
echo "Next steps:"
echo "  1. Place images in the 'original' directory"
echo "  2. Run 'npm run optimize' to process them"
echo ""
echo "Git hooks installed:"
echo "  • pre-commit: Runs ESLint before each commit"
echo "  • pre-push: Runs full test suite before push"