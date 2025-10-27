import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Issues } from '#types'
import { fileExists } from '#common'

import {
	filesMustHaveContent,
	filesMustHaveShape,
	getNpmLatestVersion,
	packageJsonMustNotHaveDependencies,
	pkgRoot,
} from '#common'
import detectIndent from 'detect-indent'

export const issues: Issues = async function* issues({ project }) {
	// Check that there is only one configuration file.
	{
		const configContent = `[lint]
# https://docs.astral.sh/ruff/formatter/#format-suppression
ignore = [
	'W191',   # tab-indentation
	'E111',   # indentation-with-invalid-multiple
	'E114',   # indentation-with-invalid-multiple-comment
	'E117',   # over-indented
	'D206',   # docstring-tab-indentation
	'D300',   # triple-single-quotes
	'Q000',   # bad-quotes-inline-string
	'Q001',   # bad-quotes-multiline-string
	'Q002',   # bad-quotes-docstring
	'Q003',   # avoidable-escaped-quote
	'COM812', # missing-trailing-comma
	'COM819', # prohibited-trailing-comma
]

[format]
docstring-code-format = true
docstring-code-line-length = 20
indent-style = 'tab'
`

		// https://docs.astral.sh/ruff/configuration/#config-file-discovery
		yield* filesMustHaveContent({
			'ruff.toml': configContent,
		})

		if (await fileExists('pyproject.toml')) {
			yield* filesMustHaveShape({
				'pyproject.toml': {
					tool: {
						ruff: {
							__delete: null,
						},
					},
				},
			})
		}
	}
}
