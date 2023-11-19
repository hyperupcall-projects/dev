import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { makeRule, pkgRoot } from '../../util/util.js'

export async function rule() {
	const editorconfigFile = path.join(pkgRoot('@hyperupcall/configs'), '.editorconfig')
	const editorconfigConfig = await fs.readFile(editorconfigFile, 'utf-8')

	await makeRule(() => {
		return {
			description: 'File must exist: .editorconfig',
			async shouldFix() {
				return fs
					.stat('.editorconfig')
					.then(() => false)
					.catch(() => true)
			},
			async fix() {
				await fs.writeFile('.editorconfig', editorconfigConfig)
			}
		}
	})

	await makeRule(() => {
		return {
			description: 'File must not be empty: .editorconfig',
			async shouldFix() {
				return (await fs.readFile('.editorconfig', 'utf-8')).length === 0
			},
			async fix() {
				await fs.writeFile('.editorconfig', editorconfigConfig)
			}
		}
	})
}
