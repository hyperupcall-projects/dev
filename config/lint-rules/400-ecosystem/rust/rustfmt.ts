import { fileExists, filesMustHaveContent, pkgRoot } from "#common";
import type { Issues } from "#types";
import fs from "node:fs/promises";
import path from "node:path";

export const issues: Issues = async function* issues() {
	yield* filesMustHaveContent('rustfmt', {
		'rustfmt.toml': await fs.readFile(path.join(pkgRoot(), 'config/rustfmt.toml'), 'utf-8')
	})
}
