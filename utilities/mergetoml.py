#!/usr/bin/env python3
# /// script
# requires-python = '>=3.11'
# dependencies = [
#   'tomlkit',
# ]
# ///
import sys

import tomlkit
from tomlkit.container import Container
from tomlkit.items import AbstractTable, AoT


def merge_containers(base: Container, override: Container) -> None:
    for key, value in override.body:
        if key is None:
            continue

        if key in base:
            base_val = base[key]
            # Inline tables are merged too, so that e.g. `foo = { path = "..", version = "1" }`
            # keeps its other keys when only `version` is overridden.
            if isinstance(base_val, AbstractTable) and isinstance(value, AbstractTable):
                merge_containers(base_val, value.value)
            elif (
                isinstance(base_val, AoT)
                and isinstance(value, AoT)
                and len(base_val) == len(value)
            ):
                # Same-length arrays of tables are merged element-wise.
                for base_table, override_table in zip(base_val, value):
                    merge_containers(base_table.value, override_table.value)
            else:
                base[key] = value
        else:
            base.add(key, value)


def main():
    if len(sys.argv) != 3:
        print("Usage: mergetoml.py <file1> <file2>", file=sys.stderr)
        sys.exit(1)

    try:
        with open(sys.argv[1]) as f:
            doc = tomlkit.load(f)
        with open(sys.argv[2]) as f:
            override = tomlkit.load(f)

        merge_containers(doc, override)
        print(tomlkit.dumps(doc), end="")

    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error merging TOML files: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
