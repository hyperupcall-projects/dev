import { filesMustHaveContent, pkgRoot } from '#common'
import type { Issues } from '#types'
import fs from 'node:fs/promises'
import path from 'node:path'

export const issues: Issues = async function* issues() {
	yield* filesMustHaveContent('clang-tidy', {
		'.clang-tidy': await fs.readFile(path.join(pkgRoot(), 'config/.clang-tidy'), 'utf-8'),
	})
}
