import * as fs from 'node:fs/promises'
import path from 'node:path'

import { makeRule, pkgRoot } from '../../util/util.js'

/** @type {import('../../util/util.js').RuleMaker} */
export async function rule() {
	await makeRule(() => {
		return {
			description: 'File must exist: LICENSE',
			async shouldFix() {
				return fs
					.stat('LICENSE')
					.then(() => false)
					.catch(() => true)
			},
			async fix() {
				const licenseFile = path.join(pkgRoot(), 'assets/LICENSE-MPL-2.0')
				await fs.writeFile('LICENSE', await fs.readFile(licenseFile, 'utf-8'))
			},
		}
	})

	await makeRule(() => {
		return {
			description: 'File must not be empty: LICENSE',
			async shouldFix() {
				return (await fs.readFile('.editorconfig', 'utf-8')).length === 0
			},
			async fix() {
				const licenseFile = path.join(pkgRoot(), 'assets/LICENSE-MPL-2.0')
				await fs.writeFile('LICENSE', await fs.readFile(licenseFile, 'utf-8'))
			},
		}
	})
}
