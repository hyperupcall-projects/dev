import { execa, execaCommand } from 'execa'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * @typedef {import('node:fs').Dirent} Dirent
 */

/**
 * @typedef RunnerParam
 * @property {string} orgDir
 * @property {Dirent} orgEntry
 * @property {string} repoDir
 * @property {Dirent} repoEntry
 *
 * @typedef RunnerOptions
 * @property {string[]} [ignores]
 *
 *
 * @param {string} organizationsDir
 * @param {RunnerOptions} options
 * @param {(arg0: RunnerParam) => Promise<void>} fn
 */
export async function forEachRepository(organizationsDir, options, fn) {
	if (typeof options === 'function') {
		fn = options
		options = {}
	}

	for (const orgEntry of await fs.readdir(organizationsDir, {
		withFileTypes: true,
	})) {
		const orgDir = path.join(orgEntry.parentPath, orgEntry.name)
		if (!orgEntry.isDirectory()) {
			continue
		}

		for (const repoEntry of await fs.readdir(orgDir, {
			withFileTypes: true,
		})) {
			const repoDir = path.join(repoEntry.parentPath, repoEntry.name)
			if (!repoEntry.isDirectory()) {
				continue
			}

			if (Array.isArray(options.ignores)) {
				const shouldSkip = options.ignores.some((ignoreEntry) => {
					if (ignoreEntry === orgEntry.name) {
						return true
					}

					if (ignoreEntry === `${orgEntry.name}/${repoEntry.name}`) {
						return true
					}

					return false
				})

				if (shouldSkip) {
					continue
				}
			}

			await fn({ orgDir, orgEntry, repoDir, repoEntry })
		}
	}
}

export async function getServiceData() {
	const services = [
		{
			name: 'brain.service',
			isUserService: true,
		},
		{ name: 'keymon.service', isUserService: false },
	]

	const data = await Promise.all(
		services.map(async (service) => {
			const [isActive, statusOutput] = await Promise.all([
				execa('systemctl', [
					...(service.isUserService ? ['--user'] : []),
					'is-active',
					'--quiet',
					service.name,
				])
					.then(({ failed }) => !failed)
					.catch(() => false),
				execa('systemctl', [
					...(service.isUserService ? ['--user'] : []),
					'status',
					service.name,
				])
					.then(({ stdout }) => stdout)
					.catch(() => ''),
			])

			return {
				name: service.name,
				isActive,
				statusOutput,
			}
		}),
	)

	return data
}
