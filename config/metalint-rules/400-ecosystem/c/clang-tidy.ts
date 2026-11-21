import { filesMustHaveContent } from '#utilities/metalint-utils.ts'
import { pkgRoot } from '#utilities/util.ts'
import type { Issues } from '#types'
import fs from 'node:fs/promises'
import path from 'node:path'

export const issues: Issues = async function* issues() {
	yield* filesMustHaveContent('clang-tidy', {
		'.clang-tidy': await fs.readFile(path.join(pkgRoot(), 'config/.clang-tidy'), 'utf-8'),
	})
}
