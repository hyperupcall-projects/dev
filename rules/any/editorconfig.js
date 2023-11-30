import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { pkgRoot } from '../../util/util.js'

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
			async shouldFix() {
				return !(await fileExists(configFile))
			},
			async fix() {
				return await fs.writeFile(configFile, configContent)
			}
		},
		{
			id: 'editorconfig-is-not-empty',
			deps: [() => fileExists(configFile)],
			async shouldFix() {
				return (await fs.readFile(configFile, 'utf-8')).length === 0
			},
			async fix() {
				return await fs.writeFile(configFile, configContent)
			}
		}
	]
}
