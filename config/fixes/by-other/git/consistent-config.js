import * as fs from 'node:fs/promises'
import path from 'node:path'

import { fileExists } from '../../../common.js'
import { execa } from 'execa'

export const skip = false

/** @type {import('../../../../index.js').Issues} */
export async function* issues({ project }) {

	const output = await execa('git', ['remote', '--verbose'])

	const remotes = new Set()
	for (const line of output.stdout.split('\n')) {
		const [remoteName, remoteUrl] = line.split(/\s+/)
		if (remotes.has(remoteName)) {
			continue
		}
		remotes.add(remoteName)

		// TODO: remoteName === origin
		if (remoteUrl.endsWith('.git')) {
			yield {
				message: [
					`Remote URL "${remoteUrl}" should not end in ".git"`
				],
				fix: async () => await execa('git', ['remote', 'set-url', remoteName, /(?<url>.*?)\.git$/.exec(remoteUrl)?.groups?.url])
			}
		}
	}
}
