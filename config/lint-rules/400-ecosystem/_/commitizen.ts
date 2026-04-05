import {
	filesMustHaveContent,
	filesMustHaveName,
	pkgRoot,
} from '#common'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Issues } from '#types'

export const issues: Issues = async function* issues() {
	// Check that there is only one configuration file.
	{
		// https://commitizen-tools.github.io/commitizen/config/configuration_file/#file-location-and-search-order
		yield* filesMustHaveName({
			'.cz.toml': ['cz.toml'],
		})
		yield* filesMustHaveContent('commitizen', {
			'.cz.json': null,
			'cz.json': null,
			'.cz.yaml': null,
			'cz.yaml': null
		})
	}

	yield* filesMustHaveContent('commitizen', {
		'.cz.toml': await fs.readFile(
			path.join(pkgRoot(), 'config/.cz.toml'), 'utf-8',
		),
	})
}
