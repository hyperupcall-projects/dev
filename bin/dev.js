#!/usr/bin/env node
import * as util from 'node:util'
import enquirer from 'enquirer'
import { run as runExport } from '../export/export.js'
import { run as runNew } from '../new/new.js'
import { run as runFix } from '../fix/fix.js'
import { run as runInstall } from '../src/install.js'

const { prompt } = enquirer

if (process.argv.includes('--help')) {
	console.info(`template <subcommand> [args...]:
  template export [args...]
  template fix [args...]
  template new [args...]
`)
	process.exit(0)
}

if (process.argv[2] === 'export') {
	await runExport(process.argv.slice(3))
}  else if (process.argv[2] === 'new') {
	await runNew(process.argv.slice(3))
} else if (process.argv[2] === 'fix') {
	await runFix(process.argv.slice(3))
} else if (process.argv[2] === 'install') {
	await runInstall(process.argv.slice(3))
} else {
	const /** @type {{ value: string }} */ { value: subcommand } = await prompt({
			type: 'select',
			name: 'value',
			message: 'Choose subcommand',
			choices: ['export', 'new', 'fix', 'install'],
		})

	if (subcommand === 'export') {
		await runExport(process.argv.slice(2))
	} else if (subcommand === 'new') {
		await runNew(process.argv.slice(2))
	} else if (subcommand === 'fix') {
		await runFix(process.argv.slice(2))
	} else if (process.argv[2] === 'install') {
		await runInstall(process.argv.slice(2))
	}
}
