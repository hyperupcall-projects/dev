import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { pkgRoot } from '../../util/util.js'
import {
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
} from '../../util/rules.js'

/** @type {import('../../index.js').CreateRules} */
export const createRules = async function createRules() {
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
