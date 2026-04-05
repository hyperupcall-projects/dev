import {
	filesMustHaveContent,
	filesMustHaveName,
} from '#common'
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
}
