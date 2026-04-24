#!/usr/bin/env python3
"""
Script to remove duplicate links from Git.md and ~Other.md.
A link is considered a duplicate if it exists in any other markdown file in the project.
Only the duplicates in Git.md and ~Other.md are removed.
"""

import os
import re
from collections import defaultdict
from pathlib import Path


def extract_links_from_file(file_path):
    """
    Extract all markdown links from a file.
    Returns a set of link URLs.
    """
    links = set()

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except (FileNotFoundError, UnicodeDecodeError):
        return links

    # Match markdown links [text](url)
    pattern = r"\[([^\]]+)\]\(([^)]+)\)"
    matches = re.finditer(pattern, content)

    for match in matches:
        link_url = match.group(2)
        links.add(link_url)

    return links


def find_all_markdown_files(root_path):
    """Find all markdown files in the project."""
    md_files = []
    for root, dirs, files in os.walk(root_path):
        for file in files:
            if file.endswith(".md"):
                md_files.append(os.path.join(root, file))
    return sorted(md_files)


def main():
    base_path = Path.home() / "Documents" / "Catalogs"

    # Files we're removing duplicates from
    git_file = base_path / "Computing Other" / "Git.md"
    other_file = base_path / "~Other.md"
    target_files = [str(git_file), str(other_file)]

    print("Finding all markdown files...")
    all_md_files = find_all_markdown_files(str(base_path))
    print(f"Found {len(all_md_files)} markdown files\n")

    # Extract links from all files
    print("Extracting links from all files...")
    all_links_by_file = {}
    for md_file in all_md_files:
        links = extract_links_from_file(md_file)
        if links:
            all_links_by_file[md_file] = links

    # Find which URLs are duplicates (exist in other files)
    print("Identifying duplicate links...\n")

    # For each target file, find which URLs also exist in other files
    for target_file in target_files:
        if target_file not in all_links_by_file:
            print(f"Warning: {target_file} not found")
            continue

        target_name = "Git.md" if "Git.md" in target_file else "~Other.md"
        target_links = all_links_by_file[target_file]

        # Find URLs that exist in other files
        duplicate_urls = set()
        for url in target_links:
            for other_file in all_md_files:
                if other_file != target_file and other_file in all_links_by_file:
                    if url in all_links_by_file[other_file]:
                        duplicate_urls.add(url)
                        break

        print(f"{target_name}: Found {len(duplicate_urls)} duplicate link(s)")

        if not duplicate_urls:
            print(f"  No changes needed for {target_name}\n")
            continue

        # Read the file
        with open(target_file, "r", encoding="utf-8") as f:
            lines = f.readlines()

        # Filter out lines containing duplicate URLs
        new_lines = []
        removed_count = 0

        for line in lines:
            # Check if this line contains any duplicate URL
            should_remove = False
            for dup_url in duplicate_urls:
                # Escape special regex characters in URL
                escaped_url = re.escape(dup_url)
                # Check if this line contains a link with this URL
                pattern = r"\[([^\]]+)\]\(" + escaped_url + r"\)"
                if re.search(pattern, line):
                    should_remove = True
                    removed_count += 1
                    break

            if not should_remove:
                new_lines.append(line)

        # Write back to file
        with open(target_file, "w", encoding="utf-8") as f:
            f.writelines(new_lines)

        print(f"  ✓ Removed {removed_count} line(s) from {target_name}\n")

    print("✓ Done! Duplicates have been removed from target files.")


if __name__ == "__main__":
    main()
