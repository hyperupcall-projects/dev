import * as fs from 'node:fs/promises'
import path from 'node:path'
import { filesMustHaveContent } from '#utilities/metalint-utils.ts'
import { pkgRoot } from '#utilities/util.ts'
import type { PackageJson } from 'type-fest'
import type { Issues } from '#types'

export const issues: Issues = async function* issues() {
	const packageJson: PackageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
	if (packageJson.private !== false) return

	yield* filesMustHaveContent('github-actions-publish', {
		'.github/workflows/publish.yaml': await fs.readFile(
			path.join(pkgRoot(), 'config/gh-actions-publish.yaml'),
			'utf-8',
		),
	})
}
