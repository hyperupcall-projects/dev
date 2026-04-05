import { fileExists } from '#common'
import type { Issues } from '#types'
import fs from 'node:fs/promises'

export const issues: Issues = async function* issues({ project }) {
	if (project.type === 'only-directory') {
		throw new Error(`Expected project to be associated with a Git repository`)
	}

	const configFile = '.gitattributes'

	let content = ''
	try {
		content = await fs.readFile(configFile, 'utf-8')
	} catch (err) {
		if (err.code !== 'ENOENT') {
			throw err
		}
	}

	const badStrings = ['# foxxo', '# foxxy', '#section:fox-tools']
	for (const string of badStrings) {
		if (content.includes(string)) {
			yield {
				message: [
					`Expected to find no line that contains "${string}"`,
				],
				fix: async () => {
					const newLines = content.split('\n').filter(line => !line.includes(string))
					await fs.writeFile(configFile, newLines.join('\n'), 'utf-8')
				},
			}
		}
	}

	if (await fileExists('bake') && !content.includes('bake linguist-generated')) {
		yield {
			message: [
				`Expected to find a line that contains "bake linguist-generated"`,
				`The file "bake" exists.`,
			],
			fix: async () => {
				const newLines = content.split('\n')
				newLines.push('bake linguist-generated')
				await fs.writeFile(configFile, newLines.join('\n'), 'utf-8')
			},
		}
	}
}
