import { filesMustHaveContent, filesMustHaveName } from '#utilities/metalint-utils.ts'
import { pkgRoot } from '#utilities/util.ts'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Issues } from '#types'

export const issues: Issues = async function* issues() {
	yield* filesMustHaveName({
		'.config/hk.pkl': ['hk.pkl'],
	})
	yield* filesMustHaveContent('hk', {
		'.config/hk.pkl': await fs.readFile(path.join(pkgRoot(), 'config/hk.pkl'), 'utf-8'),
	})
}
