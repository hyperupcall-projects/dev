#!/usr/bin/env python3
"""
Script to check for duplicate links between Git.md and ~Other.md against all other markdown files.
If a link exists in Git.md or ~Other.md AND in any other markdown file, it's flagged as a duplicate.
"""

import os
import re
from collections import defaultdict
from pathlib import Path


def extract_links_from_file(file_path):
    """
    Extract all markdown links from a file.
    Returns a dict mapping link URLs to the link texts.
    """
    links = {}

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except (FileNotFoundError, UnicodeDecodeError):
        return links

    # Match markdown links [text](url)
    pattern = r"\[([^\]]+)\]\(([^)]+)\)"

    matches = re.finditer(pattern, content)
    for match in matches:
        link_text = match.group(1)
        link_url = match.group(2)
        if link_url not in links:
            links[link_url] = []
        links[link_url].append(link_text)

    return links


def find_all_markdown_files(root_path):
    """
    Find all markdown files in the project.
    Returns a list of file paths.
    """
    md_files = []
    for root, dirs, files in os.walk(root_path):
        for file in files:
            if file.endswith(".md"):
                md_files.append(os.path.join(root, file))
    return sorted(md_files)


def main():
    base_path = Path(__file__).parent

    # The two files we're checking against
    git_file = base_path / "Computing Other" / "Git.md"
    other_file = base_path / "~Other.md"

    print("Finding all markdown files...")
    all_md_files = find_all_markdown_files(str(base_path))
    print(f"Found {len(all_md_files)} markdown files\n")

    # Extract links from the two target files
    git_links = extract_links_from_file(str(git_file))
    other_links = extract_links_from_file(str(other_file))

    print(f"Git.md contains {len(git_links)} unique links")
    print(f"~Other.md contains {len(other_links)} unique links\n")

    # Combine all links from both target files
    target_links = {}
    for url, texts in git_links.items():
        if url not in target_links:
            target_links[url] = {"files": set(), "texts": set()}
        target_links[url]["files"].add("Git.md")
        target_links[url]["texts"].update(texts)

    for url, texts in other_links.items():
        if url not in target_links:
            target_links[url] = {"files": set(), "texts": set()}
        target_links[url]["files"].add("~Other.md")
        target_links[url]["texts"].update(texts)

    # Check all other markdown files for these links
    duplicates = defaultdict(lambda: {"target_files": set(), "other_files": []})

    for md_file in all_md_files:
        # Skip the target files themselves
        if md_file == str(git_file) or md_file == str(other_file):
            continue

        file_links = extract_links_from_file(md_file)

        for url in file_links:
            if url in target_links:
                duplicates[url]["target_files"] = target_links[url]["files"]
                duplicates[url]["other_files"].append(md_file)

    # Print results
    if duplicates:
        print(f"Found {len(duplicates)} duplicate link(s):\n")
        print("=" * 100)
        for url in sorted(duplicates.keys()):
            target_files = duplicates[url]["target_files"]
            other_files = duplicates[url]["other_files"]

            print(f"\nURL: {url}")
            print(f"  Found in target file(s): {', '.join(sorted(target_files))}")
            print(f"  Also found in:")
            for other_file in other_files:
                # Make path relative to base
                rel_path = os.path.relpath(other_file, base_path)
                print(f"    - {rel_path}")
    else:
        print("No duplicate links found between target files and other markdown files.")


if __name__ == "__main__":
    main()
