// SPDX-License-Identifier: MPL-2.0
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { fileExists, pkgRoot } from '../../../../fix/util.js'

/** @type {import('../../../../index.js').CreateRules} */
export const createRules = async function createRules() {
	const configFile = '.editorconfig'
	const configPath = path.join(pkgRoot('@hyperupcall/configs'), configFile)
	const configContent = await fs.readFile(configPath, 'utf-8')

	return [
		{
			id: 'editorconfig-exists',
			async shouldFix() {
				return !(await fileExists(configFile))
			},
			async fix() {
				return await fs.writeFile(configFile, configContent)
			},
		},
		{
			id: 'editorconfig-is-not-empty',
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
