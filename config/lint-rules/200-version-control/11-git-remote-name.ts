import * as fs from 'node:fs/promises'
import path from 'node:path'

import { fileExists } from '#common'
import { execa } from 'execa'

/** @type {import('../../../index.ts').Issues} */
export async function* issues({ project }) {
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
