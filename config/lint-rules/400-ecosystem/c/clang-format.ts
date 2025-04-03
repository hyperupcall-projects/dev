import fs from 'node:fs/promises'
import { fileExists, filesMustHaveContent, filesMustHaveShape } from '#common'
import type { Issues } from '#types'
import dedent from 'dedent'

export const issues: Issues = async function* issues({ project }) {
	const content = dedent`
		{
			BasedOnStyle: LLVM,
			UseTab: ForIndentation,
			IndentWidth: 3,
			TabWidth: 3,
			AlignEscapedNewlines: Left,
			AllowShortFunctionsOnASingleLine: Empty,
			AlwaysBreakTemplateDeclarations: Yes,
			ColumnLimit: 120,
		}\n`
	yield* filesMustHaveContent({ '.clang-format': content })
}
