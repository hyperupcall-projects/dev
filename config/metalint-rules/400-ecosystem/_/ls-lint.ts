import type { Issues } from '#types'
import { filesMustHaveContent } from '#utilities/metalint-utils.ts'

export const issues: Issues = async function* issues() {
	yield* filesMustHaveContent('ls-lint', {
		'.ls-lint.yaml': null,
		'.ls-lint.yml': null,
	})
}
