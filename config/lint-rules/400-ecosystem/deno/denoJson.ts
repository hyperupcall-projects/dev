import fs from 'node:fs/promises'

import { fileExists, filesMustHaveContent, filesMustHaveShape } from '#common'

import type { Issues } from '#types'
export const issues: Issues = async function* issues({ project }) {
	{
		const file = 'deno.json'
		if (await fileExists(file)) {
			yield {
				message: [
					`Expected file "${file}" to not exist`,
					'But, found the file',
					'File should be called "deno.jsonc" instead.',
				],
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
