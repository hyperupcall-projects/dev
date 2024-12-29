import path from 'node:path'

import { execa } from 'execa'

/**
 * Check that the name of the remote repository matches the local directory name.
 */

/** @type {import('../../../index.js').Issues} */
export async function* issues({ project }) {
	// Loop through all remotes instead of just `project.name`.
	const output = await execa('git', ['remote', '--verbose'])
	if (!output.stdout) return

	for (const line of output.stdout.split('\n')) {
		const [, remoteUrl] = line.split(/\s+/)
		const localProjectName = path.basename(project.rootDir)
		const remoteProjectName = remoteUrl.slice(remoteUrl.lastIndexOf('/') + 1)
		if (localProjectName !== remoteProjectName) {
			yield {
				message: [
					`Local and remote project names do mot match`,
					`Local project has name of "${localProjectName}"`,
					`Remote project has name of "${remoteProjectName}"`,
				],
			}
		}
	}
}
