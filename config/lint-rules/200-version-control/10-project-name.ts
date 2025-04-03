import path from 'node:path'

import { execa } from 'execa'
import type { Issues } from '#types'

/**
 * Check that the name of the remote repository matches the local directory name.
 */

export const issues: Issues = async function* issues({ project }) {
	// Loop through all remotes instead of just `project.name`.
	const output = await execa('git', ['remote', '--verbose'])
	if (!output.stdout) return

	for (const line of output.stdout.split('\n')) {
		const [, remoteUrl] = line.split(/\s+/)
		const localProjectName = path.basename(project.rootDir)
		const remoteProjectName = remoteUrl.slice(remoteUrl.lastIndexOf('/') + 1)
		if (localProjectName !== remoteProjectName) {
			yield {
				id: 'local-remote-name-mismatch',
				message: [
					`Local and remote project names do mot match`,
					`Local project has name of "${localProjectName}"`,
					`Remote project has name of "${remoteProjectName}"`,
				],
			}
		}
	}
}
