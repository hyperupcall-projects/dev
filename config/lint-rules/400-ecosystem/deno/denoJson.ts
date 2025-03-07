import fs from 'node:fs/promises'

import { fileExists, filesMustHaveContent, filesMustHaveShape } from '#common'

/** @type {import('../../../../index.ts').Issues} */
export const issues = async function* issues({ project }) {
	{
		const file = 'deno.json'
		if (await fileExists(file)) {
			yield {
				message: [`Expected file "${file}" to not exist`, 'But, found the file'],
				fix: async () => {
					if (await fileExists('deno.jsonc')) {
						await fs.rm(file)
					} else {
						await fs.rename(file, 'deno.jsonc')
					}
				},
			}
		}
	}

	yield* filesMustHaveShape({
		'deno.jsonc': {
			fmt: {
				useTabs: true,
				lineWidth: 100,
				indentWidth: 3,
				semiColons: false,
				singleQuote: true,
			},
		},
	})
}
