import { execa } from 'execa'

export const skip = true

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues() {
	const { stdout, stderr, exitCode } = await execa('npx', ['publint'])
	if (!stdout.includes('All good!')) {
		console.log(stdout)
	}
	// TODO
	if (exitCode !== 0) {
		yield {
			message: ['Publint should succeed'],
		}
	}
}
