import { fileExists } from '#common'
import type { Issues } from '#types'
import fs from 'node:fs/promises'

export const skip = true

export const issues: Issues = async function* issues() {
	const configFile = '.gitattributes'

	let content = ''
	try {
		content = await fs.readFile(configFile, 'utf-8')
	} catch (err) {
		if (err.code !== 'ENOENT') {
			throw err
		}
	}

	const badStrings = ['# foxxo', '#section:fox-tools']
	for (const string of badStrings) {
		if (content.includes(string)) {
			yield {
				message: [
					`Expected to find no line that contains "${string}"`,
				],
			}
		}
	}

	if (await fileExists('bake') && !content.includes('bake linguist-generated')) {
		yield {
			message: [
				`Expected to find a line that contains "bake linguist-generated"`,
				`The file "bake" exists.`,
			],
		}
	}
}
