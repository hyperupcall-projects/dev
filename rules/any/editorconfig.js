import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { makeRule, pkgRoot } from '../../util/util.js'

/** @type {import('../../util/util.js').CreateRules} */
export async function createRules() {
	const configFile = '.editorconfig'
	const configPath = path.join(pkgRoot('@hyperupcall/configs'), configFile)
	const configContent = await fs.readFile(configPath, 'utf-8')

	function fileExists(file) {
		return fs
			.stat(file)
			.then(() => true)
			.catch(() => false)
	}

	return [
		{
			id: 'editorconfig-exists',
			shouldFix: async () => !(await fileExists(configFile)),
			fix: () => fs.writeFile(configFile, configContent)
		},
		{
			id: 'editorconfig-is-not-empty',
			deps: [() => fileExists(configFile)],
			shouldFix: async () => (await fs.readFile(configFile, 'utf-8')).length === 0,
			fix: () => fs.writeFile(configFile, configContent)
		}
	]
}
