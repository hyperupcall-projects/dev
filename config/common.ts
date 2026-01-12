import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import util, { styleText } from 'node:util'
import { execa } from 'execa'
import { createRequire } from 'node:module'

import { Octokit } from 'octokit'
import detectIndent from 'detect-indent'
import dedent from 'dedent'
import * as diff from 'diff'
import dotenv from 'dotenv'
import { globby } from 'globby'
import jsonc from 'jsonc-parser'

import type { Issue } from '#types'
import process from 'node:process'

const require = createRequire(import.meta.url)

dotenv.config({ path: path.join(import.meta.dirname, '../.env') })

export const octokit = new Octokit({ auth: process.env.GITHUB_AUTH_TOKEN })

export const skipHyperupcallFunding = ['ecc-computing-club']

export async function* filesMustHaveName(
	mapping: Record<string, string[]>,
): AsyncGenerator<Issue> {
	for (let goodFile in mapping) {
		const badFiles = mapping[goodFile]
		if (goodFile.slice(0, 2) === './') {
			goodFile = goodFile.slice(2)
		}

		for (let badFile of badFiles) {
			if (badFile.slice(0, 2) === './') {
				badFile = badFile.slice(2)
			}

			if (await fileExists(badFile)) {
				const correctFileExists = await fileExists(goodFile)
				if (correctFileExists) {
					yield {
						message: dedent`
							-> Expected file "${badFile}" to not exist because "${goodFile}" already exists
							-> But, found both files exist`,
					}
				} else {
					yield {
						message: dedent`
							-> Expected file to be named "${goodFile}"
							-> But, found file named "${badFile}"`,
						fix: () => fs.rename(badFile, goodFile),
					}
				}
			}
		}
	}
}

export async function* filesMustHaveContent(
	mapping: Record<string, null | string>,
): AsyncGenerator<Issue> {
	for (let file in mapping) {
		const expectedContent = mapping[file]

		if (file.slice(0, 2) === './') {
			file = file.slice(2)
		}

		if (expectedContent === null) {
			if (await fileExists(file)) {
				yield {
					message: [`Expected file "${file}" to not exist`, 'But, found the file'],
					fix: () => fs.rm(file),
				}
			}
		} else {
			if (await fileExists(file)) {
				const content = await fs.readFile(file, 'utf-8')
				if (content !== expectedContent) {
					yield {
						message: dedent`
							-> Expected file "${file}" to have content:
							${'='.repeat(80)}
							${expectedContent}
							${'='.repeat(80)}
							-> But, the file has content:
							${'='.repeat(80)}
							${content}
							${'='.repeat(80)}
							`,
						fix: () => fs.writeFile(file, expectedContent),
					}
				}
			} else {
				yield {
					message: dedent`
						-> Expected file "${file}" to exist and have content:
						${'='.repeat(80)}
						${expectedContent}
						${'='.repeat(80)}
						-> But, the file does not exist
						`,
					fix: () => fs.writeFile(file, expectedContent),
				}
			}
		}
	}
}

export async function* filesMustHaveShape(
	mapping: Record<string, Record<string, unknown>>,
): AsyncGenerator<Issue> {
	for (let file in mapping) {
		const source = mapping[file]

		if (file.slice(0, 2) === './') {
			file = file.slice(2)
		}

		const content = await fs.readFile(file, 'utf-8')
		const actual = file.endsWith('.jsonc') ? jsonc.parse(content) : JSON.parse(content)
		const expected = structuredClone(actual)
		customMerge(expected, source)

		if (!util.isDeepStrictEqual(expected, actual)) {
			const oldStr = content
			const newStr = JSON.stringify(expected, null, detectIndent(content).indent ?? '  ')
			const rawPatch = diff.createPatch(file, oldStr, newStr, undefined, undefined, {
				context: 4,
			})
			const patch = rawPatch
				.replace(/^[\s\S]*\n.*?=\n/, '')
				.replaceAll(/\n\+(?!\+)/g, '\n' + styleText('green', '+'))
				.replaceAll(/\n-(?!\-)/g, '\n' + styleText('red', '-'))

			yield {
				message: dedent`
					-> Expected file "${file}" to have the correct shape:
					${'='.repeat(80)}
					${patch.replaceAll('\n', '\n' + '\t'.repeat(5))}${'='.repeat(80)}
					`,
				fix: () =>
					fs.writeFile(
						file,
						// TODO: Handle JSON.stringify in all places, so that if on jsonc file,
						// and if it has all trailing commas say in object, it's not removed in the diff
						JSON.stringify(expected, null, detectIndent(content).indent || '\t'),
					),
			}
		}
	}
}

export async function* packageJsonMustNotHaveDependencies(substr: string) {
	const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
	for (
		const dependencyKey of [
			'dependencies',
			'devDependencies',
			'peerDependencies',
			'peerDependenciesMeta',
			'bundleDependencies',
			'optionalDependencies',
		]
	) {
		for (const dependencyName in packageJson[dependencyKey] ?? {}) {
			if (dependencyName.includes(substr)) {
				yield {
					message: [
						`Expected to find no dependencies that included the string "${substr}"`,
						`But, found "${dependencyName}"`,
					],
					fix: async () => {
						const content = await fs.readFile('package.json', 'utf-8')
						const json = JSON.parse(content)
						delete json[dependencyKey][dependencyName]
						await fs.writeFile(
							'package.json',
							JSON.stringify(json, null, detectIndent(content).indent || '\t'),
						)
					},
				}
			}
		}
	}
}

export function customMerge(target: Record<string, any>, source: Record<string, any>) {
	for (const key in source) {
		if (Object.hasOwn(target, key)) {
			if (typeof source[key] === 'object' && source[key] !== null) {
				if (Object.hasOwn(source[key], '__delete')) {
					delete target[key]
				} else if (Object.hasOwn(source[key], '__replace')) {
					delete source[key].__replace
					target[key] = source[key]
					customMerge(target[key], source[key])
				} else {
					Object.assign(target[key], source[key])
					customMerge(target[key], source[key])
				}
			} else {
				target[key] = source[key]
				if (typeof target[key] === 'object' && target[key] !== null) {
					customMerge(target[key], source[key])
				}
			}
		} else {
			if (typeof source[key] === 'object' && source[key] !== null) {
				if (Object.hasOwn(source[key], '__delete')) {
				} else if (Object.hasOwn(source[key], '__replace')) {
					target[key] = source[key]
					customMerge(target[key], source[key])
				} else {
					target[key] = {}
					Object.assign(target[key], source[key])
					customMerge(target[key], source[key])
					if (Object.keys(target[key]).length === 0) {
						delete target[key]
					}
				}
			} else {
				target[key] = source[key]
				if (typeof target[key] === 'object' && target[key] !== null) {
					customMerge(target[key], source[key])
				}
			}
		}
	}
}

export async function fileExists(filepath: string): Promise<boolean> {
	return await fs
		.stat(filepath)
		.then(() => true)
		.catch(() => false)
}

export function pkgRoot(packageName?: string) {
	if (!packageName) {
		return path.dirname(import.meta.dirname)
	} else {
		return path.dirname(require.resolve(packageName))
	}
}

export async function writeTrees(trees: Record<string, string>[]) {
	for (const tree of trees) {
		for (const [filepath, content] of Object.entries(tree)) {
			await fs.mkdir(path.dirname(filepath), { recursive: true })
			await fs.writeFile(filepath, content)
		}
	}
}

export async function getNpmLatestVersion(packages: string[]) {
	const latestVersionsObjects = await Promise.all(
		packages.map((packageName) => execa('npm', ['view', '--json', packageName])),
	)
	const latestVersions = latestVersionsObjects.map((result) => {
		if (result.exitCode !== 0) {
			console.error(result.stderr)
			throw new Error(result)
		}

		const obj = JSON.parse(result.stdout)
		return obj['dist-tags'].latest
	})
	return latestVersions
}

export async function findCodeOfConductFiles() {
	return await globby(
		['*code_of_conduct*', '.github/*code_of_conduct*', 'docs/*code_of_conduct*'],
		{ caseSensitiveMatch: false },
	)
}
