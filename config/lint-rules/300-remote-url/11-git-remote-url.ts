import { execa } from 'execa'
import type { Issues } from '#types'
import { styleText } from 'node:util'

export const issues: Issues = async function* issues({ project }) {
	const output = await execa('git', ['remote', '--verbose'])
	if (!output.stdout) return

	const remotes = output.stdout.split('\n')
		.map((line) => line.split(/\s+/))

	const badRemotes = remotes.filter(([, remoteUrl]) => remoteUrl.endsWith('.git'))
	if (badRemotes.length > 0) {
		yield {
			message: [
				...new Set(badRemotes.map(
					([, remoteUrl]) => `Remote URL "${remoteUrl}" should not end in ".git"`,
				)),
			],
			fix: async () => {
				for (const [remoteName, remoteUrl] of badRemotes) {
					await execa('git', [
						'remote',
						'set-url',
						remoteName,
						remoteUrl.slice(0, remoteUrl.lastIndexOf('.git')),
					])
				}
			},
		}
	}

	{
		// TODO: Batch this network call
		const response = await fetch(`https://github.com/${project.owner}/${project.name}`, {
			method: 'HEAD',
		})
		const [, redirectOwner, redirectName] = response.url.match(/github.com\/([^/]+)\/([^/]+)/)
		const shouldURL = `git@github.com:${redirectOwner}/${redirectName}`

		const badRemotes: string[] = []
		for (const [remoteName, remoteUrl] of remotes) {
			if (!remoteUrl.startsWith('git@github.com')) {
				console.info(
					`${
						styleText('yellow', 'WARN:')
					} Skipping remoteUrl check for "${remoteUrl}" since it is not an GitHub SSH URL`,
				)
				continue
			}

			if (project.owner !== redirectOwner || project.name !== redirectName) {
				badRemotes.push([remoteName, remoteUrl, shouldURL])
			}
		}

		if (badRemotes.length > 0) {
			yield {
				message: [
					...new Set(badRemotes.map(
						([remoteName, remoteUrl, shouldURL]) =>
							`Remote name "${remoteName}" has URL "${remoteUrl}" but it should be "${shouldURL}"`,
					)),
				],
				fix: async () => {
					for (const [remoteName, , shouldURL] of badRemotes) {
						await execa('git', [
							'remote',
							'set-url',
							remoteName,
							shouldURL,
						])
					}
				},
			}
		}
	}
}
