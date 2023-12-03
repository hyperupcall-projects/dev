import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import detectIndent from 'detect-indent'

import { pkgRoot } from '../../util/util.js'
import {
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
} from '../../util/rules.js'
import { execa } from 'execa'

/** @type {import('../../util/util.js').CreateRules} */
export async function createRules() {
	return [
		{
			id: 'markdownlint-config-exists',
			...(await (async () => {
				const configFile = path.join(
					pkgRoot('@hyperupcall/configs'),
					'.markdownlint.json',
				)
				const configContent = await fs.readFile(configFile, 'utf-8')

				return await ruleFileMustExistAndHaveContent({
					file: '.markdownlint.json',
					content: configContent,
				})
			})()),
		},
		{
			id: 'markdownlint-has-dependencies',
			...(await ruleCheckPackageJsonDependencies({
				mainPackageName: 'markdownlint',
				packages: ['markdownlint', '@hyperupcall/markdownlint-config'],
			})),
		},
	]
}
