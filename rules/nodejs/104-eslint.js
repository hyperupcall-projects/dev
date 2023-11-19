import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import detectIndent from 'detect-indent'

import { makeRule, pkgRoot } from '../../util/util.js'
import { execa } from 'execa'

export async function rule() {
	const eslintFile = path.join(pkgRoot('@hyperupcall/configs'), '.eslintrc.json')
	const eslintConfig = await fs.readFile(eslintFile, 'utf-8')

	await makeRule(() => {
		return {
			description: 'File must exist: .eslintrc.json',
			async shouldFix() {
				return fs
					.stat('.eslintrc.json')
					.then(() => false)
					.catch(() => true)
			},
			async fix() {
				await fs.writeFile('.eslintrc.json', eslintConfig)
			}
		}
	})

	await makeRule(() => {
		return {
			description: 'File must have the correct text: .eslintrc.json',
			async shouldFix() {
				return (await fs.readFile('.eslintrc.json', 'utf-8')) !== eslintConfig
			},
			async fix() {
				await fs.writeFile('.eslintrc.json', eslintConfig)
			}
		}
	})
}
