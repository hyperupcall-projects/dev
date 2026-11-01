import process from 'node:process'
import * as clack from '@clack/prompts'
import { execa } from 'execa'
import semver from 'semver'

import {
	detectEcosystem,
	incrementVersionEcosystem,
} from '#utilities/ecosystems.ts'
import type { CommandVersionOptions } from '#types'

export async function run(
	options: CommandVersionOptions,
	positionals: string[],
) {
	const rootDir = process.cwd()
	const ecosystemIds = await detectEcosystem({ rootDir })

	const { stdout: statusOutput } = await execa('git', [
		'status',
		'--porcelain',
	])
	if (statusOutput.trim() !== '') {
		console.error(
			'Working directory is not clean. Please commit or stash your changes first.',
		)
		process.exit(1)
	}

	try {
		const latestTag = await getLatestTag()
		const currentVersion = latestTag.replace(/^v/, '')
		if (!semver.valid(currentVersion)) {
			console.error(
				`Latest tag "${latestTag}" is not a valid semantic version`,
			)
			process.exit(1)
		}

		console.log(`\nCurrent version: ${latestTag}`)
		const finalVersion = await askForNewVersion(currentVersion)

		const modifiedFiles = new Set<string>()
		for (const ecosystemId of ecosystemIds) {
			for (const modifiedFile of await incrementVersionEcosystem(
				ecosystemId,
				rootDir,
				finalVersion,
			)) {
				modifiedFiles.add(modifiedFile)
			}
		}

		if (modifiedFiles.size > 0) {
			await execa('git', ['add', ...modifiedFiles])
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

async function getLatestTag() {
	const { stdout: tagsOutput } = await execa('git', [
		'tag',
		'--list',
		'v*',
		'--sort=-version:refname',
	])
	const tags = tagsOutput.split('\n').filter((tag) => tag.trim() !== '')

	if (tags.length === 0) {
		console.log('No version tags found')

		const initialVersion = await clack.text({
			message: 'Enter the initial version (without "v" prefix):',
			defaultValue: '0.1.0',
			validate: (value) => {
				if (!semver.valid(value)) {
					return 'Please enter a valid semantic version (e.g., 0.1.0)'
				}
			},
		})

		if (clack.isCancel(initialVersion)) {
			process.exit(1)
		}

		return initialVersion
	}

	const latest5 = tags.slice(0, 5)
	console.log('\nLatest 5 releases:')
	latest5.forEach((tag, index) => {
		console.log(`${index + 1}. ${tag}`)
	})

	return tags[0]
}

async function askForNewVersion(currentVersion: string) {
	const patchVersion = semver.inc(currentVersion, 'patch')!
	const minorVersion = semver.inc(currentVersion, 'minor')!
	const majorVersion = semver.inc(currentVersion, 'major')!

	const newVersion = await clack.select({
		message: 'What version would you like to update to?',
		options: [
			{ label: `Patch: v${patchVersion} (bug fixes)`, value: patchVersion },
			{
				label: `Minor: v${minorVersion} (new features)`,
				value: minorVersion,
			},
			{
				label: `Major: v${majorVersion} (breaking changes)`,
				value: majorVersion,
			},
			{ label: 'Custom version', value: 'custom' },
		],
	})

	if (clack.isCancel(newVersion)) {
		process.exit(1)
	}

	let finalVersion: string
	if (newVersion === 'custom') {
		const customVersion = await clack.text({
			message: 'Enter custom version (without "v" prefix):',
			validate: (value) => {
				if (!value || !semver.valid(value)) {
					return 'Please enter a valid semantic version (e.g., 1.2.3)'
				}
				if (semver.lte(value, currentVersion)) {
					return `Version must be greater than current version ${currentVersion}`
				}
			},
		})

		if (clack.isCancel(customVersion)) {
			process.exit(1)
		}

		finalVersion = customVersion
	} else {
		finalVersion = newVersion as string
	}

	return finalVersion
}

async function createVersionCommitAndTag(version: string) {
	try {
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
