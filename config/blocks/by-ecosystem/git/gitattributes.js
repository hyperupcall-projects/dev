import * as fs from 'node:fs/promises'
import path from 'node:path'

import { fileExists } from '../../../../fix/util.js'

/** @type {import('../../../../index.js').CreateRules} */
export function createRules({ project }) {
	const configFile = '.gitattributes'

	return [
		{
			id: 'gitattributes-is-minimal',
			async shouldFix() {
				/** @type {string} */
				let attributes = ''
				try {
					attributes = await fs.readFile(configFile, 'utf-8')
				} catch (err) {
					if (err.code !== 'ENOENT') {
						throw err
					}
				}

				const newAttributes = await minimalGitAttributes(attributes)

				return newAttributes !== attributes
			},
			async fix() {
				/** @type {string} */
				let attributes = ''
				try {
					attributes = await fs.readFile(configFile, 'utf-8')
				} catch (err) {
					if (err.code !== 'ENOENT') {
						throw err
					}
				}
				const newAttributes = await minimalGitAttributes(attributes)

				if (typeof newAttributes === 'string') {
					await fs.writeFile(configFile, newAttributes)
				} else {
					await fs.rm(configFile).catch((err) => {
						if (err.code === 'ENOENT') {
							return
						}
						throw err
					})
				}
			},
		},
	]
}

async function minimalGitAttributes(/** @type {string} */ input) {
	let content = input
	content = content.replaceAll(/# foxxo /gu, '#section:fox-tools/fix ')

	if (!content.includes('#section:fox-tools/fix start')) {
		content =
			`#section:fox-tools/fix start
#section:fox-tools/fix end\n` + content
	}

	let newContent = ''
	let canRemove = false
	for (const line of content.split('\n')) {
		if (line.startsWith('#section:fox-tools/fix start')) {
			canRemove = true
			newContent += line + '\n'
			continue
		} else if (line.startsWith('#section:fox-tools/fix end')) {
			if ((await fileExists('bake')) && !content.includes('bake linguist-generated')) {
				newContent += 'bake linguist-generated\n'
			}

			canRemove = false
			newContent += line + '\n'
			continue
		}

		if (canRemove) {
			if (line.includes('text=auto') || line.includes('eol=lf')) {
				continue
			}

			if (line === 'bake linguist-generated') {
				if (!(await fileExists('bake'))) {
					continue
				}
			}
		}

		newContent += line + '\n'
	}
	content = newContent
	content = content.trimEnd()
	content += '\n'

	if (
		content ===
		`#section:fox-tools/fix start
#section:fox-tools/fix end
`
	) {
		return null
	}

	return content
}
