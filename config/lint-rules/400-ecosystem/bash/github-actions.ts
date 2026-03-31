import { fileExists, filesMustHaveContent, pkgRoot } from "#common";
import { Issues } from "#types";
import fs from "node:fs/promises";
import path from "node:path";

export const issues: Issues = async function* issues() {
	yield* filesMustHaveContent({
		'.github/workflows/website.yaml': await fs.readFile(path.join(pkgRoot(), 'config/gh-actions-bash-lint.yaml'), 'utf-8')
	})
}
