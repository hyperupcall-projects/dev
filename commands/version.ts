import * as fs from 'node:fs/promises'
import * as inquirer from '@inquirer/prompts'
import { execa } from 'execa'
import semver from 'semver'

import { getEcosystems } from '../devutils/index.ts'
import type { CommandVersionOptions } from '#types'

export async function run(options: CommandVersionOptions, positionals: string[]) {
	const ecosystems = await getEcosystems(process.cwd())

	if (ecosystems.length === 0) {
		console.error('No supported ecosystem detected in current directory')
		process.exit(1)
	}

	// For now, we only support the 'c' ecosystem as specified
	if (!ecosystems.includes('c')) {
		console.error('Version command currently only supports C projects')
		console.error(`Detected ecosystems: ${ecosystems.join(', ')}`)
		process.exit(1)
	}

	await handleCEcosystem()
}

async function handleCEcosystem() {
	try {
		const { stdout: tagsOutput } = await execa('git', [
			'tag',
			'--list',
			'v*',
			'--sort=-version:refname',
		])
		const tags = tagsOutput.split('\n').filter((tag) => tag.trim() !== '')

		if (tags.length === 0) {
			console.log('No version tags found')

			const initialVersion = await inquirer.input({
				message: 'Enter the initial version (without "v" prefix):',
				default: '0.1.0',
				validate: (input) => {
					if (!semver.valid(input)) {
						return 'Please enter a valid semantic version (e.g., 0.1.0)'
					}
					return true
				},
			})

			await createVersionCommitAndTag(`v${initialVersion}`)
			return
		}

		const latest5 = tags.slice(0, 5)
		console.log('\nLatest 5 releases:')
		latest5.forEach((tag, index) => {
			console.log(`${index + 1}. ${tag}`)
		})

		const latestTag = tags[0]
		const currentVersion = latestTag.replace(/^v/, '')

		if (!semver.valid(currentVersion)) {
			console.error(`Latest tag "${latestTag}" is not a valid semantic version`)
			process.exit(1)
		}

		console.log(`\nCurrent version: ${latestTag}`)

		// Suggest next versions
		const patchVersion = semver.inc(currentVersion, 'patch')!
		const minorVersion = semver.inc(currentVersion, 'minor')!
		const majorVersion = semver.inc(currentVersion, 'major')!

		const newVersion = await inquirer.select({
			message: 'What version would you like to update to?',
			choices: [
				{ name: `Patch: v${patchVersion} (bug fixes)`, value: patchVersion },
				{ name: `Minor: v${minorVersion} (new features)`, value: minorVersion },
				{ name: `Major: v${majorVersion} (breaking changes)`, value: majorVersion },
				{ name: 'Custom version', value: 'custom' },
			],
		})

		let finalVersion: string
		if (newVersion === 'custom') {
			finalVersion = await inquirer.input({
				message: 'Enter custom version (without "v" prefix):',
				validate: (input) => {
					if (!semver.valid(input)) {
						return 'Please enter a valid semantic version (e.g., 1.2.3)'
					}
					if (semver.lte(input, currentVersion)) {
						return `Version must be greater than current version ${currentVersion}`
					}
					return true
				},
			})
		} else {
			finalVersion = newVersion
		}

		await createVersionCommitAndTag(`v${finalVersion}`)
	} catch (err) {
		if (err.exitCode === 128) {
			console.error('Not a git repository or no git tags found')
		} else {
			console.error('Error:', err.message)
		}
		process.exit(1)
	}
}

async function createVersionCommitAndTag(version: string) {
	try {
		const { stdout: statusOutput } = await execa('git', ['status', '--porcelain'])
		if (statusOutput.trim() !== '') {
			console.error('Working directory is not clean. Please commit or stash your changes first.')
			process.exit(1)
		}

		await execa('git', ['commit', '--allow-empty', '-m', version], {
			stdio: 'inherit',
		})

		console.log(`✓ Created commit with message: ${version}`)

		await execa('git', ['tag', '-a', version, '-m', version], {
			stdio: 'inherit',
		})

		console.log(`✓ Created annotated tag: ${version}`)
		console.log(`\nVersion ${version} has been successfully created!`)
		console.log(`\nTo push the changes and tag to remote, run:`)
		console.log(`  git push && git push --tags`)
	} catch (error: any) {
		console.error('Error creating commit and tag:', error.message)
		process.exit(1)
	}
}
