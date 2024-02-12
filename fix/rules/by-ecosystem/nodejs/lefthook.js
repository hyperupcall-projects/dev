import {
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
} from '../../rules/rules.js'

/** @type {import('../../../../index.js').CreateRules} */
export const createRules = async function createRules() {
	const configContent = `assert_lefthook_installed = true\n`

	return [
		{
			id: 'lefthook-config-exists',
			async shouldFix() {},
		},
	]
}
