import * as fs from 'node:fs/promises'
import path from 'node:path';

import { makeRule, pkgRoot } from "../../util/util.js";
import { execa } from 'execa';

export async function rule({ github }) {
	await makeRule(async () => {
		const {stdout, stderr, exitCode } = await execa('npx', ['publint'])
		if (!stdout.includes('All good!')) {
			console.log(stdout)
		}

		return {
			description: 'publint should succeed',
			async shouldFix() {
				return exitCode !== 0
			},
			async fix() {
				console.log(console.log(stdout))
			}
		}
	})
}
