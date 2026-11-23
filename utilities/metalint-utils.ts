import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import util, { styleText } from 'node:util'
import { execa } from 'execa'

import detectIndent from 'detect-indent'
import dedent from 'dedent'
import * as diff from 'diff'
import { globby } from 'globby'
import jsonc from 'jsonc-parser'

import type { Issue } from '#types'
import { fileExists } from '#utilities/util.ts'

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
						id: `${goodFile}-must-have-name`,
						message: dedent`
							-> Expected file "${badFile}" to not exist because "${goodFile}" already exists
							-> But, found both files exist`,
					}
				} else {
					yield {
						id: `${goodFile}-must-have-name`,
						message: dedent`
							-> Expected file to be named "${goodFile}"
							-> But, found file named "${badFile}"`,
						fix: async () => {
							await fs.mkdir(path.dirname(goodFile), { recursive: true })
							await fs.rename(badFile, goodFile)

							// Recursively remove empty parent directories.
							const root = process.cwd()
							let directory = path.dirname(path.resolve(badFile))
							while (
								directory !== root &&
								directory.startsWith(path.join(root, path.sep))
							) {
								try {
									await fs.rmdir(directory)
								} catch (error) {
									if (error.code === 'ENOTEMPTY' || error.code === 'EEXIST') {
										break
									}
									throw error
								}
								directory = path.dirname(directory)
							}
						},
					}
				}
			}
		}
	}
}

export async function* filesMustHaveContent(
	id: string,
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
					id: `${id}-must-have-content`,
					message: [`Expected file "${file}" to not exist`, 'But, found the file'],
					fix: () => fs.rm(file),
				}
			}
		} else {
			if (await fileExists(file)) {
				const content = await fs.readFile(file, 'utf-8')
				if (content !== expectedContent) {
					yield {
						id: `${id}-must-have-content`,
						message: dedent.withOptions({ alignValues: true })`
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
					id: `${id}-must-have-content`,
					message: dedent.withOptions({ alignValues: true })`
						-> Expected file "${file}" to exist and have content:
						${'='.repeat(80)}
						${expectedContent}
						${'='.repeat(80)}
						-> But, the file does not exist
						`,
					fix: async () => {
						await fs.mkdir(path.dirname(file), { recursive: true })
						await fs.writeFile(file, expectedContent)
					},
				}
			}
		}
	}
}

export async function* filesMustHaveShape(
	id: string,
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
				id: `${id}-must-have-correct-shape`,
				message: dedent.withOptions({ alignValues: true })`
					-> Expected file "${file}" to have the correct shape:
					${'='.repeat(80)}
					${patch}
					${'='.repeat(80)}
					`,
				fix: () =>
					fs.writeFile(
						file,
						JSON.stringify(expected, null, detectIndent(content).indent || '\t'),
					),
			}
		}
	}
}

export async function* packageJsonMustNotHaveDependencies(
	substr: string,
): AsyncGenerator<Issue> {
	const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
	for (const dependencyKey of [
		'dependencies',
		'devDependencies',
		'peerDependencies',
		'peerDependenciesMeta',
		'bundleDependencies',
		'optionalDependencies',
	]) {
		for (const dependencyName in packageJson[dependencyKey] ?? {}) {
			if (dependencyName.includes(substr)) {
				yield {
					id: `${substr}-must-not-have-dependencies`,
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

export async function writeTrees(trees: Record<string, string>[]) {
	for (const tree of trees) {
		for (const [filepath, content] of Object.entries(tree)) {
			await fs.mkdir(path.dirname(filepath), { recursive: true })
			await fs.writeFile(filepath, content)
		}
	}
}

export async function getNpmLatestVersion(packages: string[]): Promise<string[]> {
	if (packages.length === 0) return []

	const { stdout: workspaceDir } = await execa(
		'pnpm',
		['--pm-on-fail=ignore', 'prefix', '--workspace-root'],
		{ reject: false },
	)
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dev-npm-versions-'))
	try {
		// Unlike `view`, `outdated` resolves versions using minimumReleaseAge.
		// A temporary project lets it check dependencies that are not installed yet.
		await fs.writeFile(
			path.join(tmpDir, 'package.json'),
			JSON.stringify({
				private: true,
				dependencies: Object.fromEntries(packages.map((name) => [name, 'latest'])),
			}),
		)
		await fs.writeFile(
			path.join(tmpDir, 'pnpm-lock.yaml'),
			JSON.stringify({
				lockfileVersion: '9.0',
				importers: {
					'.': {
						dependencies: Object.fromEntries(
							packages.map((name) => [name, { specifier: 'latest', version: '0.0.0-0' }]),
						),
					},
				},
			}),
		)

		// pnpm exits with code 1 when it finds outdated dependencies.
		const result = await execa('pnpm', ['--pm-on-fail=ignore', 'outdated', '--json'], {
			cwd: tmpDir,
			// Read the original workspace settings with an isolated lockfile.
			env: {
				PNPM_CONFIG_WORKSPACE_DIR: workspaceDir || process.cwd(),
				PNPM_CONFIG_LOCKFILE_DIR: tmpDir,
			},
			reject: false,
		})
		if ((result.exitCode !== 0 && result.exitCode !== 1) || !result.stdout) {
			throw new Error(result.stderr || result.stdout || 'pnpm version lookup failed')
		}
		const latestVersions: Record<string, { latest?: string }> = JSON.parse(result.stdout)
		return packages.map((name) => {
			const version = latestVersions[name]?.latest
			if (!version) throw new Error(`No eligible version found for "${name}"`)
			return version
		})
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
}

export async function findCodeOfConductFiles() {
	return await globby(
		['*code_of_conduct*', '.github/*code_of_conduct*', 'docs/*code_of_conduct*'],
		{ caseSensitiveMatch: false },
	)
}
