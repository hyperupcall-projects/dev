import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import process from 'node:process'
import * as readline from 'node:readline'
import { stripVTControlCharacters, styleText } from 'node:util'
import * as clack from '@clack/prompts'
import ansiEscapes from 'ansi-escapes'
import { execa } from 'execa'
import semver from 'semver'
import toml from 'smol-toml'

import {
	detectEcosystem,
	ecosystems,
	type VersionUpdate,
} from '#utilities/ecosystems.ts'
import type { CommandVersionOptions, Config } from '#types'

export async function run(options: CommandVersionOptions) {
	const rootDir = process.cwd()
	const { stdout: statusOutput } = await execa('git', ['status', '--porcelain'])
	if (statusOutput.trim() !== '' && !options.force) {
		console.error(
			'Working directory is not clean. Please commit or stash your changes first.',
		)
		process.exit(1)
	}

	try {
		const { stdout: tagsOutput } = await execa('git', [
			'tag',
			'--list',
			'v*',
			'--sort=-version:refname',
		])
		let [latestTag,] = tagsOutput.split('\n').filter((tag) => tag.trim() !== '')
		if (!latestTag) {
			latestTag = 'v0.0.0'
		}
		const currentVersion = latestTag.replace(/^v/, '')
		if (!semver.valid(currentVersion)) {
			console.error(`Latest tag "${latestTag}" is not a valid semantic version`)
			process.exit(1)
		}

		// TODO: Interface for config
		const rootDirs = ['.', ...(await getUpdateVersionDirectories(rootDir))]

		const filesToUpdate: VersionUpdate[] = []
		for (const dir of rootDirs) {
			for (const ecosystemId of await detectEcosystem({ rootDir: path.resolve(rootDir, dir) })) {
				for (const { relativePath, oldVersion } of await ecosystems[ecosystemId].updateVersion(
					ecosystemId,
					'',
					{ dryRun: true },
				)) {
					filesToUpdate.push({
						relativePath: path.join(dir, relativePath),
						oldVersion,
					})
				}
			}
		}

		let newVersion = await askForNewVersion(currentVersion, filesToUpdate)

		let modifiedFiles: string[] = []
		for (const dir of rootDirs) {
			for (const ecosystemId of await detectEcosystem({ rootDir: path.resolve(rootDir, dir) })) {
				for (const { relativePath } of await ecosystems[ecosystemId].updateVersion(
					ecosystemId,
					newVersion,
					{ dryRun: false },
				)) {
					modifiedFiles.push(path.join(dir, relativePath))
				}
			}
		}

		if (modifiedFiles.length > 0) {
			await execa('git', ['add', ...modifiedFiles])
		}

		newVersion = `v${newVersion}`
		await execa('git', ['commit', '--allow-empty', '-m', newVersion], {
			stdio: 'inherit',
		})
		console.log(`✓ Created commit with message: ${newVersion}`)
		await execa('git', ['tag', '-a', newVersion, '-m', newVersion], {
			stdio: 'inherit',
		})
		console.log(`✓ Created annotated tag: ${newVersion}`)
	} catch (err) {
		if (err.exitCode === 128) {
			console.error('Not a git repository or no git tags found')
		} else {
			console.error('Error:', err.message)
		}
		process.exit(1)
	}
}

async function getUpdateVersionDirectories(rootDir: string): Promise<string[]> {
	try {
		const config = toml.parse(
			await fs.readFile(path.join(rootDir, 'dev.toml'), 'utf-8'),
		) as Config
		return config.updateVersionDirectories ?? []
	} catch (err) {
		if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
			return []
		}
		throw err
	}
}

async function askForNewVersion(
	currentVersion: string,
	updates: VersionUpdate[],
): Promise<string> {
	if (!process.stdin.isTTY) {
		throw new Error('Choosing a version requires an interactive terminal')
	}

	const files = [
		...new Map(updates.map((update) => [update.relativePath, update.oldVersion] as const)),
	]
	const pathWidth = Math.max(0, ...files.map(([relativePath]) => relativePath.length))
	const versionWidth = Math.max(0, ...files.map(([, oldVersion]) => oldVersion.length))

	const choices = [
		{ label: 'Patch', version: semver.inc(currentVersion, 'patch')! },
		{ label: 'Minor', version: semver.inc(currentVersion, 'minor')! },
		{ label: 'Major', version: semver.inc(currentVersion, 'major')! },
		{ label: 'Custom', version: '' },
	]
	const customIndex = choices.length - 1
	let choiceIndex = 0
	let customVersion = ''
	let renderedRows = 0

	const getCustomError = () => {
		if (!semver.valid(customVersion)) {
			return 'Please enter a valid semantic version (e.g., 1.2.3)'
		}
		if (semver.lte(customVersion, currentVersion)) {
			return `Version must be greater than current version ${currentVersion}`
		}
	}

	const getSelectedVersion = () => {
		if (choiceIndex !== customIndex) {
			return choices[choiceIndex]!.version
		}
		return getCustomError() ? undefined : semver.valid(customVersion)!
	}

	const formatFile = ([relativePath, oldVersion]: readonly [string, string], version?: string) => {
		let newVersion = styleText('green', version ?? '?')
		if (version === oldVersion) {
			newVersion = styleText('dim', 'unchanged')
		}
		return `  ${relativePath.padEnd(pathWidth)}  ${oldVersion.padEnd(versionWidth)} → ${newVersion}`
	}

	const render = () => {
		const columns = process.stdout.columns || 80
		const tabs = choices.map(({ label, version }, index) => {
			const selected = index === choiceIndex
			const value = index === customIndex ? `${customVersion}${selected ? '▏' : ''}` : version
			return styleText(selected ? ['inverse', 'bold'] : 'dim', ` ${label} ${value} `)
		})

		// Wraps between tabs, so that a narrow terminal doesn't split a tab across lines.
		const tabLines: string[] = []
		for (const tab of tabs) {
			const line = tabLines.at(-1)
			if (line !== undefined && stripVTControlCharacters(`${line} ${tab}`).length <= columns) {
				tabLines[tabLines.length - 1] = `${line} ${tab}`
			} else {
				tabLines.push(`  ${tab}`)
			}
		}

		// Leaves room for the rest of the interface, so that redrawing never scrolls.
		const maxFiles = Math.max(1, (process.stdout.rows ?? 24) - 7 - tabLines.length)
		const shownFiles = files.length > maxFiles ? files.slice(0, maxFiles - 1) : files
		const version = getSelectedVersion()
		const fileLines = shownFiles.map((file) => formatFile(file, version))
		if (shownFiles.length < files.length) {
			fileLines.push(styleText('dim', `  … and ${files.length - shownFiles.length} more`))
		}
		if (files.length === 0) {
			fileLines.push(styleText('dim', '  No relevant files found.'))
		}

		const lettersSwitch = choiceIndex !== customIndex || customVersion === ''
		const lines = [
			...tabLines,
			'',
			...fileLines,
			'',
			choiceIndex === customIndex && customVersion !== ''
				? styleText('yellow', `  ${getCustomError() ?? ''}`)
				: '',
			styleText(
				'dim',
				`  ${lettersSwitch ? 'h/l or ←/→' : '←/→'} switch • enter confirm • esc cancel`,
			),
		]

		const clear = renderedRows > 0 ? ansiEscapes.cursorUp(renderedRows) : ''
		process.stdout.write(`${clear}${ansiEscapes.eraseDown}${lines.join('\n')}\n`)
		renderedRows = lines.reduce((rows, line) => {
			return rows + Math.max(1, Math.ceil(stripVTControlCharacters(line).length / columns))
		}, 0)
	}

	return await new Promise((resolve) => {
		const finish = (version?: string) => {
			process.stdin.off('keypress', onKeypress)
			process.stdin.setRawMode(false)
			process.stdin.pause()
			process.stdout.write(
				`${ansiEscapes.cursorUp(renderedRows)}${ansiEscapes.eraseDown}${ansiEscapes.cursorShow}`,
			)

			if (version === undefined) {
				process.exit(1)
			}

			console.log(`${styleText('green', '✓')} New version: v${version}`)
			for (const file of files) {
				console.log(formatFile(file, version))
			}
			resolve(version)
		}

		const onKeypress = (input: string | undefined, key: readline.Key) => {
			if ((key.ctrl && key.name === 'c') || key.name === 'escape') {
				finish()
				return
			}

			if (key.name === 'return' || key.name === 'enter') {
				const version = getSelectedVersion()
				if (version !== undefined) {
					finish(version)
				}
				return
			}

			// Prerelease versions can contain "h" and "l", so those letters only switch
			// choices while no custom version is being typed.
			const lettersSwitch = choiceIndex !== customIndex || customVersion === ''
			if (key.name === 'left' || (lettersSwitch && input === 'h')) {
				choiceIndex = (choiceIndex + choices.length - 1) % choices.length
			} else if (key.name === 'right' || (lettersSwitch && input === 'l')) {
				choiceIndex = (choiceIndex + 1) % choices.length
			} else if (choiceIndex === customIndex && key.name === 'backspace') {
				customVersion = customVersion.slice(0, -1)
			} else if (
				choiceIndex === customIndex &&
				!key.ctrl &&
				!key.meta &&
				input !== undefined &&
				/^[0-9A-Za-z.+-]$/.test(input)
			) {
				customVersion += input
			} else {
				return
			}

			render()
		}

		readline.emitKeypressEvents(process.stdin)
		process.stdin.setRawMode(true)
		process.stdin.resume()
		process.stdin.on('keypress', onKeypress)
		process.stdout.write(ansiEscapes.cursorHide)
		render()
	})
}
