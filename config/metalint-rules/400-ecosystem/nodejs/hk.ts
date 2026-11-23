import { filesMustHaveContent } from '#utilities/metalint-utils.ts'
import { pkgRoot } from '#utilities/util.ts'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Issues } from '#types'

export const issues: Issues = async function* issues() {
	yield* filesMustHaveContent('hk', {
		'hk.pkl': await fs.readFile(path.join(pkgRoot(), 'config/hk.pkl'), 'utf-8'),
	})
}
