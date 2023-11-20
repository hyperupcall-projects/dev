import * as fs from 'node:fs/promises'
import path from 'node:path';

import { makeRule, pkgRoot } from "../../util/util.js";

export async function rule() {
	await makeRule(() => {
		return {
			description: 'File must exist: .gitattributes',
			async shouldFix() {
				return fs
					.stat('.gitattributes')
					.then(() => false)
					.catch(() => true)
			},
			async fix() {
				await fs.writeFile('.gitattributes', `# foxxo start
* text=auto eol=lf
bake linguist-generated
# foxxo end
`)
			}
		}
	})

	await makeRule(() => {
		return {
			description: 'gitattributes must include: * text=auto eol=lf',
			async shouldFix() {
				return !(await fs.readFile('.gitattributes', 'utf-8')).includes('* text=auto eol=lf\n')
			}
		}
	})

	await makeRule(() => {
		return {
			description: 'gitattributes must include: bake linguist-generated',
			async shouldFix() {
				return !(await fs.readFile('.gitattributes', 'utf-8')).includes('bake linguist-generated\n')
			}
		}
	})
}
