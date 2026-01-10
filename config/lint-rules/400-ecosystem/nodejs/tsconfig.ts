import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { TsConfigJson } from 'type-fest'
import type { Issues } from '#types'
import dedent from 'dedent'
import * as diff from 'diff'

import { filesMustHaveContent, filesMustHaveShape, getNpmLatestVersion, pkgRoot } from '#common'
import detectIndent from 'detect-indent'
import { styleText } from 'node:util'

export const issues: Issues = async function* issues({ project }) {
	for (const configFile of ['tsconfig.json', 'jsconfig.json']) {
		let configText = ''
		try {
			configText = await fs.readFile(configFile, 'utf-8')
		} catch (err) {
			if (err.code !== 'ENOENT') throw err
			continue
		}

		const originalConfig: TsConfigJson = JSON.parse(configText)
		const config: TsConfigJson = structuredClone(originalConfig)

		if (!config?.compilerOptions) {
			continue
		}
		config.compilerOptions.jsx
		for (
			const property of [
				'jsx',
				'module',
				'moduleResolution',
				'newLine',
				'target',
				'importsNotUsedAsValues',
			] as const
		) {
			if (
				typeof config.compilerOptions[property] === 'string'
			) {
				config.compilerOptions[property] = config.compilerOptions[property].toLowerCase()
			}
		}

		for (let i = 0; i < (config.compilerOptions.lib ?? []).length; ++i) {
			config.compilerOptions.lib[i] = config.compilerOptions.lib[i].toLowerCase()
		}

		const oldStr = JSON.stringify(originalConfig, null, detectIndent(configText).indent)
		const newStr = JSON.stringify(config, null, detectIndent(configText).indent)
		if (oldStr !== newStr) {
			const rawPatch = diff.createPatch(configFile, oldStr, newStr, undefined, undefined, {
				context: 4,
			})
			const patch = rawPatch
				.replace(/^.*?\n.*?=\n/, '')
				.replaceAll(/\n\+(?!\+)/g, '\n' + styleText('green', '+'))
				.replaceAll(/\n-(?!\-)/g, '\n' + styleText('red', '-'))

			yield {
				message: dedent`
					-> Expected file "${configFile}" to have the correct shape:
					${'='.repeat(80)}
					${patch.replaceAll('\n', '\n' + '\t'.repeat(5))}${'='.repeat(80)}
					`,
				fix: () =>
					fs.writeFile(
						configFile,
						newStr,
					),
			}
		}
	}
}
