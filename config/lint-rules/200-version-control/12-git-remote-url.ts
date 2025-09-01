import { execa } from 'execa'
import type { Issues } from '#types'

export const issues: Issues = async function* issues() {
	const output = await execa('git', ['remote', '--verbose'])
	if (!output.stdout) return

	for (const line of output.stdout.split('\n')) {
		const [remoteName, remoteUrl] = line.split(/\s+/)
		if (remoteUrl.endsWith('.git')) {
			yield {
				message: [`Remote URL "${remoteUrl}" should not end in ".git"`],
				fix: async () =>
					await execa('git', [
						'remote',
						'set-url',
						remoteName,
						remoteUrl.slice(0, remoteUrl.lastIndexOf('.git')),
					]),
			}
		}
	}
}
