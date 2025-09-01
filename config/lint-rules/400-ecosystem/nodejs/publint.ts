import { execa } from 'execa'
import type { Issues } from '#types'

export const skip = true

export const issues: Issues = async function* issues() {
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
