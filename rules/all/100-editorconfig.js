import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { makeRule, pkgRoot } from '../../util/util.js'

export async function rule() {
	const editorconfigFile = path.join(pkgRoot('@hyperupcall/configs'), '.editorconfig')
	const editorconfigConfig = await fs.readFile(editorconfigFile, 'utf-8')

	await makeRule(
		'File must exist: .editorconfig',
		() => {
			return fs
				.stat('.editorconfig')
				.then(() => false)
				.catch(() => true)
		},
		async () => {
			await fs.writeFile('.editorconfig', editorconfigConfig)
		},
	)

	await makeRule(
		'File must not be empty: .editorconfig',
		async () => {
			return (await fs.readFile('.editorconfig', 'utf-8')).length === 0
		},
		async () => {
			await fs.writeFile('.editorconfig', editorconfigConfig)
		}
	)
}
