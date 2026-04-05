import { execa } from 'execa'
import type { Issues } from '#types'

export const issues: Issues = async function* issues({ project }) {
	if (project.type === 'only-directory') {
		throw new Error(`Expected project to be associated with a Git repository`)
	}

	const output = await execa('git', ['remote', '--verbose'])
	if (!output.stdout) return

	for (const line of output.stdout.split('\n')) {
		const [remoteName] = line.split(/\s+/)

		const approvedRemoteNames = ['me', 'upstream']
		if (!approvedRemoteNames.includes(remoteName)) {
			yield {
				message: [
					`Expected "${remoteName}" to be one of ${JSON.stringify(approvedRemoteNames)}`,
				],
			}
		}
	}
}
