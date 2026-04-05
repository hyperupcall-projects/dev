import {
	filesMustHaveContent,
	pkgRoot,
} from '#common'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Issues } from '#types'

export const issues: Issues = async function* issues() {
	yield* filesMustHaveContent('clang-format', {
		'.clang-format': await fs.readFile(
			path.join(pkgRoot(), 'config/.clang-format'), 'utf-8',
		),
	})
}
