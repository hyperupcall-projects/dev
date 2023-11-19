import * as fs from 'node:fs/promises'
import path from 'node:path';

import { makeRule, pkgRoot } from "../../util/util.js";

export async function rule({ github }) {
	await makeRule(() => {
		return {
			description: 'README.md must exist',
			async shouldFix() {
				return fs
					.stat('README.md')
					.then(() => false)
					.catch(() => true)
			},
			async fix() {
				await fs.writeFile('README.md', `# ${github.repo}\n`)
			}
		}
	})

	await makeRule(() => {
		return {
			description: 'README.md must begin with # $repo',
			async shouldFix() {
				return !(await fs.readFile('README.md', 'utf-8')).match(`^# ${github.repo}`)
			}
		}
	})
}
