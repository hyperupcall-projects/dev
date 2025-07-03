import { octokit } from '#common'
import type { Issues } from '#types'
import { execa } from 'execa'

export const issues: Issues = async function* issues({ project }) {
	if (project.type !== 'with-remote-url') {
		throw new Error(`Expected project to be associated with a remote`)
	}

	const { data } = await octokit.rest.repos.get({
		owner: project.owner,
		repo: project.name,
	})

	// Check the repository owner and name.
	if (data.full_name !== `${project.owner}/${project.name}`) {
		yield {
			message: [
				'Expected GitHub repository to be in sync with local remote URL',
				`But, they are out of sync`,
				`Found GitHub repository with full_name of "${data.full_name}"`,
				`Found remote to have URL of "${project.remoteUrl}"`,
			],
		}
	}
}
