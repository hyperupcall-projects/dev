import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { pkgRoot } from '../../util/util.js'
import {
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
} from '../../util/rules.js'

/** @type {import('../../util/util.js').CreateRules} */
export async function createRules() {
	async function eslintConfigExists() {
		return await fs
			.stat('.eslintrc.json')
			.then(() => true)
			.catch(() => false)
	}

	return [
		{
			id: 'eslint-config-exists',
			...await (async () => {
				const configFile = path.join(pkgRoot('@hyperupcall/configs'), '.eslintrc.json')
				const configContent = await fs.readFile(configFile, 'utf-8')

				return await ruleFileMustExistAndHaveContent({
					file: '.eslintrc.json',
					content: configContent,
				})
			})()
		},
		{
			id: 'eslint-has-dependencies',
			...await ruleCheckPackageJsonDependencies({
				mainPackageName: 'eslint',
				packages: [
					'eslint',
					'eslint-config-prettier',
					'eslint-plugin-import',
					'@hyperupcall/eslint-config',
				],
			})
		},
	]
}
