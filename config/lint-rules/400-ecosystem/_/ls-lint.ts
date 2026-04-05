import {
	filesMustHaveContent,
	pkgRoot,
} from '#common'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Issues } from '#types'

export const issues: Issues = async function* issues() {
	yield* filesMustHaveContent('lslint', {
		'.ls-lint.yml': await fs.readFile(
			path.join(pkgRoot(), 'config/.ls-lint.yml'), 'utf-8',
		),
	})
}
