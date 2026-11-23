import { filesMustHaveContent } from '#utilities/metalint-utils.ts'
import { pkgRoot } from '#utilities/util.ts'
import type { Issues } from '#types'
import fs from 'node:fs/promises'
import path from 'node:path'

export const issues: Issues = async function* issues() {
	yield* filesMustHaveContent('github-actions', {
		'.github/workflows/bash-lint.yaml': await fs.readFile(
			path.join(pkgRoot(), 'config/gh-actions-bash-lint.yaml'),
			'utf-8',
		),
	})
}
