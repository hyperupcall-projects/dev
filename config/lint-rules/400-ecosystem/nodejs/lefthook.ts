import type { Issues } from '#types'

export const skip = true

export const issues: Issues = async function* issues({ project }) {
	const configContent = `assert_lefthook_installed = true\n`
}
