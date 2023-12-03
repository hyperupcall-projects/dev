import * as fs from 'node:fs/promises'
import path from 'node:path'

import { fileExists, pkgRoot } from '../../util/util.js'

/** @type {import('../../util/util.js').CreateRules} */
export async function createRules() {
	const configFile = 'LICENSE'
	const configPath = path.join(pkgRoot(), 'assets/LICENSE-MPL-2.0')
	const configContent = await fs.readFile(configPath, 'utf-8')

	return [
		{
			id: 'license-exists',
			async shouldFix() {
				return !(await fileExists(configFile))
			},
			async fix() {
				return await fs.writeFile(configFile, configContent)
			},
		},
		{
			id: 'license-is-not-empty',
			deps: [() => fileExists(configFile)],
			async shouldFix() {
				return (await fs.readFile(configFile, 'utf-8')).length === 0
			},
			async fix() {
				return await fs.writeFile(configFile, configContent)
			},
		},
	]
}
