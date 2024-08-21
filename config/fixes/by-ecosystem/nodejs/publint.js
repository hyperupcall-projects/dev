import { execa } from 'execa'
import { ruleCheckPackageJsonDependencies } from '../../../../fix/rules.js'

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues() {
	const { stdout, stderr, exitCode } = await execa('npx', ['publint'])
	if (!stdout.includes('All good!')) {
		console.log(stdout)
	}

	if (exitCode !== 0) {
		yield {
			title: 'Publint should succeed'
		}
	}
}
