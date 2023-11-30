import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import detectIndent from 'detect-indent'

import {
	makeRule,
	pkgRoot,
	checkPackageJsonDependencies,
	fileMustExistAndHaveContent,
} from '../../util/util.js'
import { execa } from 'execa'

/** @type {import('../../util/util.js').RuleMaker} */
export async function rule() {
	await makeRule(async () => {
		const configFile = path.join(pkgRoot('@hyperupcall/configs'), '.eslintrc.json')
		const configContent = await fs.readFile(configFile, 'utf-8')

		return await fileMustExistAndHaveContent({
			file: '.eslintrc.json',
			content: configContent,
		})
	})

	await makeRule(
		async () =>
			await checkPackageJsonDependencies({
				mainPackageName: 'eslint',
				packages: ['eslint', 'eslint-config-prettier', 'eslint-plugin-import', '@hyperupcall/eslint-config'],
			}),
	)
}
