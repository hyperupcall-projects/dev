import * as fs from 'node:fs/promises'
import * as YAML from 'yaml'
import { filesMustHaveContent, filesMustHaveName } from '#utilities/metalint-utils.ts'
import { fileExists } from '#utilities/util.ts'
import type { Issues } from '#types'

export const issues: Issues = async function* issues() {
	// Check that there is only one configuration file.
	{
		// https://cspell.org/docs/Configuration
		yield* filesMustHaveName({
			'.cspell.yaml': [
				'.cspell.config.yaml',
				'.cspell.config.yml',
				'cspell.config.yaml',
				'cspell.config.yml',
				'.cspell.yml',
				'cspell.yaml',
				'cspell.yml',
			],
		})
		yield* filesMustHaveContent('cspell', {
			// JSON
			'cspell.json': null,
			'.cSpell.json': null,
			'cSpell.json': null,
			'.cspell.json': null,
			'.cspell.jsonc': null,
			'cspell.jsonc': null,
			'.cspell.config.json': null,
			'.cspell.config.jsonc': null,
			'cspell.config.json': null,
			'cspell.config.jsonc': null,
			// JavaScript
			'cspell.config.mjs': null,
			'cspell.config.cjs': null,
			'cspell.config.js': null,
			'.cspell.config.mjs': null,
			'.cspell.config.cjs': null,
			'.cspell.config.js': null,
			// TypeScript
			'cspell.config.mts': null,
			'cspell.config.ts': null,
			'cspell.config.cts': null,
			'.cspell.config.mts': null,
			'.cspell.config.ts': null,
			'.cspell.config.cts': null,
			// TOML
			'cspell.config.toml': null,
			'.cspell.config.toml': null,
			// VSCODE JSON
			'.vscode/cspell.json': null,
			'.vscode/cSpell.json': null,
			'.vscode/.cspell.json': null,
		})
	}

	if (await fileExists('.cspell.yaml')) {
		const config = YAML.parseDocument(await fs.readFile('.cspell.yaml', 'utf-8'))
		if (config.get('enableGlobDot') !== true) {
			yield {
				id: 'cspell-must-enable-glob-dot',
				message: 'Expected .cspell.yaml to set enableGlobDot as true',
				fix: async () => {
					config.set('enableGlobDot', true)
					await fs.writeFile('.cspell.yaml', config.toString())
				},
			}
		}
	}
}
