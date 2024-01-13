import {
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
} from '../../util/rules.js'

/** @type {import('../../index.js').CreateRules} */
export const createRules = async function createRules() {
	const configContent = `assert_lefthook_installed = true\n`

	return [
		{
			fix: 'lefthook-config-exists',
			async shouldFix() {},
		},
	]
}
