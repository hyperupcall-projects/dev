#!/usr/bin/env bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BUILD_DIR="build"

echo -e "${BLUE}Building HTML files from Markdown...${NC}"

# Create build directory if it doesn't exist
if [ -d "$BUILD_DIR" ]; then
    echo "Cleaning existing build directory..."
    rm -rf "$BUILD_DIR"
fi

mkdir -p "$BUILD_DIR"

# Counter for files processed
count=0

# Find all .md files recursively and convert them
while IFS= read -r md_file; do
    # Get the relative path from current directory
    rel_path="${md_file#./}"

    # Create the output path, preserving directory structure
    output_path="$BUILD_DIR/${rel_path%.md}.html"

    # Create the directory structure in build if needed
    output_dir=$(dirname "$output_path")
    mkdir -p "$output_dir"

    # Convert markdown to HTML using pandoc
    echo "Converting: $rel_path -> $output_path"
    pandoc "$md_file" \
        -f markdown \
        -t html \
        --standalone \
        --metadata title="$(basename "${md_file%.md}")" \
        -o "$output_path"

    ((count++))
done < <(find . -name "*.md" -type f ! -path "./node_modules/*" ! -path "./.hidden/*" ! -path "./.git/*")

echo -e "${GREEN}✓ Successfully converted $count markdown files to HTML${NC}"
echo -e "${GREEN}✓ Output directory: $BUILD_DIR${NC}"
