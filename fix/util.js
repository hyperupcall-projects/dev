import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import chalk from 'chalk'
import { execa } from 'execa'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { Octokit } from 'octokit'

const require = createRequire(import.meta.url)

export const octokit = new Octokit({ auth: process.env.GITHUB_AUTH_TOKEN })

/**
 * @param {string} filepath
 * @returns {Promise<boolean>}
 */
export async function fileExists(filepath) {
	return await fs
		.stat(filepath)
		.then(() => true)
		.catch(() => false)
}

/**
 * @param {string} [packageName]
 * @returns {string}
 */
export function pkgRoot(packageName) {
	if (packageName === void 0) {
		return path.dirname(path.dirname(new URL(import.meta.url).pathname))
	} else {
		return path.dirname(require.resolve(packageName))
	}
}

/**
 * @param {string} configFileName
 */
export function getConfigPath(configFileName) {
	const thisLocation = path.join(pkgRoot(), configFileName)
	if (existsSync(thisLocation)) {
		return thisLocation
	}

	const thatLocation = path.join(pkgRoot('@hyperupcall/configs'), configFileName)
	if (existsSync(thatLocation)) {
		return thatLocation
	}

	throw new Error(`Failed to find config file with name: ${configFileName}`)
}

/**
 * @param {Record<string, any>[]} trees
 */
export async function writeTrees(trees) {
	for (const tree of trees) {
		for (const [filepath, content] of Object.entries(tree)) {
			await fs.mkdir(path.dirname(filepath), { recursive: true })
			await fs.writeFile(filepath, content)
		}
	}
}

export async function getNpmLatestVersion(/** @type {string[]} */ packages) {
	const latestVersionsObjects = await Promise.all(
		packages.map((packageName) => execa('npm', ['view', '--json', packageName])),
	)
	const latestVersions = latestVersionsObjects.map((result) => {
		if (result.exitCode !== 0) {
			console.log(result.stderr)
			throw new Error(result)
		}

		const obj = JSON.parse(result.stdout)
		return obj['dist-tags'].latest
	})
	return latestVersions
}
