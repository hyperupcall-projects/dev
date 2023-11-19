import * as fs from 'node:fs/promises'
import path from 'node:path';

import { makeRule, pkgRoot } from "../../util/util.js";

export async function rule() {
	await makeRule(
		'File must exist: LICENSE',
		() => {
			return fs
				.stat('LICENSE')
				.then(() => false)
				.catch(() => true)
		},
		async () => {
			const licenseFile = path.join(pkgRoot(), 'assets/LICENSE-MPL-2.0')
			await fs.writeFile('LICENSE', await fs.readFile(licenseFile, 'utf-8'))
		},
	)

	await makeRule(
		'File must not be empty: LICENSE',
		async () => {
			return (await fs.readFile('.editorconfig', 'utf-8')).length === 0
		},
		async () => {
			const licenseFile = path.join(pkgRoot(), 'assets/LICENSE-MPL-2.0')
			await fs.writeFile('LICENSE', await fs.readFile(licenseFile, 'utf-8'))
		},
	)
}
