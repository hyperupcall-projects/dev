// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2023 Edwin Kofler
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import process from 'node:process'
import { styleText } from 'node:util'
import * as clack from '@clack/prompts'
import { execa, parseCommandString } from 'execa'
import toml from 'smol-toml'

import { ignoreDirectoriesGlob, pkgRoot } from '#utilities/util.ts'
import { detectFiletypes } from '#utilities/filetype.ts'

import type { CommandLintOptions, Config } from '#types'

type Linter = {
	filetype: string
	command: string
	configFile: string
}

const LINTERS: Record<string, Linter> = {
	yamllint: {
		filetype: 'yaml',
		command: 'yamllint -c {config_file}',
		configFile: path.join(pkgRoot(), 'config/.yamllint.yaml'),
	},
}

export async function run(options: CommandLintOptions) {
	const rootDir = process.cwd()
	const overrides = await getLintOverrides(rootDir)
	const filesByFiletype = await detectFiletypes({
		rootDir,
		gitignore: false,
		followSymbolicLinks: true,
		ignore: ignoreDirectoriesGlob(),
	})

	let linterIds: string[]
	if (options.linter) {
		if (!(options.linter in LINTERS)) {
			console.error(
				`Unknown linter "${options.linter}". Available linters: ${new Intl.ListFormat(
					'en',
				).format(Object.keys(LINTERS))}`,
			)
			process.exitCode = 1
			return
		}
		linterIds = [options.linter]
	} else {
		const selection = await promptForLinters(filesByFiletype)
		if (!selection) {
			return
		}
		linterIds = selection
	}

	for (const linterId of linterIds) {
		const linter = LINTERS[linterId]
		const files = filesByFiletype[linter.filetype] ?? []
		if (files.length === 0) {
			console.info(
				`[${styleText('yellow', 'SKIP')}] ${linterId}: no ${linter.filetype} files found`,
			)
			continue
		}

		const command = overrides[linterId] ?? linter.command
		const [file, ...args] = parseCommandString(
			command.replaceAll('{config_file}', linter.configFile),
		)
		if (!file) {
			console.error(`Linter "${linterId}" has an empty command`)
			process.exitCode = 1
			continue
		}

		console.info(
			`[${styleText('blue', 'RUN')}] ${linterId}: linting ${files.length} ${linter.filetype} file(s)`,
		)
		try {
			await execa(file, [...args, ...files], { cwd: rootDir, stdio: 'inherit' })
		} catch (err) {
			console.error(
				`[${styleText('red', 'FAIL')}] ${linterId}: ${(err as Error).message}`,
			)
			process.exitCode = 1
		}
	}
}

async function promptForLinters(
	filesByFiletype: Record<string, string[]>,
): Promise<string[] | undefined> {
	const available = Object.entries(LINTERS).filter(
		([, linter]) => (filesByFiletype[linter.filetype]?.length ?? 0) > 0,
	)
	if (available.length === 0) {
		console.info('No files found to lint.')
		return
	}

	const selection = await clack.multiselect({
		message: 'Which linter(s) would you like to run?',
		options: available.map(([linterId, linter]) => ({
			value: linterId,
			label: linterId,
			hint: `${filesByFiletype[linter.filetype].length} ${linter.filetype} file(s)`,
		})),
		initialValues: available.map(([linterId]) => linterId),
		required: true,
	})

	if (clack.isCancel(selection)) {
		clack.cancel('Cancelled.')
		return
	}

	return selection
}

async function getLintOverrides(rootDir: string): Promise<Record<string, string>> {
	let config: Config
	try {
		config = toml.parse(
			await fs.readFile(path.join(rootDir, 'dev.toml'), 'utf-8'),
		) as Config
	} catch (err) {
		if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
			return {}
		}
		throw err
	}

	const overrides: Record<string, string> = {}
	for (const [linterId, command] of Object.entries(config.lint ?? {})) {
		if (typeof command === 'string' && command.trim() !== '') {
			overrides[linterId] = command
		}
	}
	return overrides
}
