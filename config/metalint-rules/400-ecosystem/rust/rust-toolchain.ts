import { filesMustHaveContent } from '#utilities/metalint-utils.ts'
import { pkgRoot } from '#utilities/util.ts'
import type { Issues } from '#types'
import fs from 'node:fs/promises'
import path from 'node:path'

export const issues: Issues = async function* issues() {
	yield* filesMustHaveContent('rust-toolchain', {
		'rust-toolchain.toml': await fs.readFile(
			path.join(pkgRoot(), 'config/rust-toolchain.toml'),
			'utf-8',
		),
	})
}
