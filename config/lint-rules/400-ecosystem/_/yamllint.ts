import {
	filesMustHaveContent,
	pkgRoot,
} from '#common'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Issues } from '#types'

export const issues: Issues = async function* issues() {
	yield* filesMustHaveContent('yamllint', {
		'.yamllint.yaml': await fs.readFile(
			path.join(pkgRoot(), 'config/.yamllint.yaml'), 'utf-8',
		),
	})
}
