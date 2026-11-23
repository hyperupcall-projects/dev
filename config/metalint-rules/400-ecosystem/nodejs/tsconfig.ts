import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { TsConfigJson } from 'type-fest'
import type { Issues } from '#types'
import dedent from 'dedent'
import * as diff from 'diff'

import {
	filesMustHaveContent,
	filesMustHaveShape,
	getNpmLatestVersion,
} from '#utilities/metalint-utils.ts'
import { pkgRoot } from '#utilities/util.ts'
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

		type Config = TsConfigJson & {
			compilerOptions?: TsConfigJson.CompilerOptions & { importsNotUsedAsValues?: string }
		}
		const originalConfig: Config = JSON.parse(configText)
		const config: Config = structuredClone(originalConfig)

		if (!config?.compilerOptions) {
			continue
		}
		const options = config.compilerOptions
		for (const property of [
			'jsx',
			'module',
			'moduleResolution',
			'newLine',
			'target',
			'importsNotUsedAsValues',
		] as const) {
			if (typeof options[property] === 'string') {
				;(options as Record<typeof property, string | undefined>)[property] =
					options[property].toLowerCase()
			}
		}

		if (options.lib) {
			options.lib = options.lib.map(
				(lib) => lib.toLowerCase() as TsConfigJson.CompilerOptions.Lib,
			)
		}

		const oldStr = JSON.stringify(originalConfig, null, detectIndent(configText).indent)
		const newStr = JSON.stringify(config, null, detectIndent(configText).indent)
		if (oldStr !== newStr) {
			const rawPatch = diff.createPatch(
				configFile,
				oldStr,
				newStr,
				undefined,
				undefined,
				{
					context: 4,
				},
			)
			const patch = rawPatch
				.replace(/^.*?\n.*?=\n/, '')
				.replaceAll(/\n\+(?!\+)/g, '\n' + styleText('green', '+'))
				.replaceAll(/\n-(?!\-)/g, '\n' + styleText('red', '-'))

			yield {
				id: 'must-have-correct-shape',
				message: dedent.withOptions({ alignValues: true })`
					-> Expected file "${configFile}" to have the correct shape:
					${'='.repeat(80)}
					${patch}
					${'='.repeat(80)}
					`,
				fix: () => fs.writeFile(configFile, newStr),
			}
		}
	}
}
