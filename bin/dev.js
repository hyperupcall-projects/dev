#!/usr/bin/env node
import * as util from 'node:util'
import path from 'node:path'
import enquirer from 'enquirer'

import { run as runExport } from '../src/_export.js'
import { run as runNew } from '../src/new.js'
import { run as runFix } from '../src/fix.js'
import { run as runInstall } from '../src/install.js'
import { run as runRepos } from '../src/repos.js'
import { run as runScript } from '../src/script.js'

const { prompt } = enquirer

if (process.argv.includes('--help')) {
	console.info(`dev <subcommand> [args...]
  dev export [args...]
  dev new [args...]
  dev fix [args...]
  dev install [args...]
  dev repos [args...]
  dev script [args...]
`)
	process.exit(0)
}

let subcommand = ''
let args = []
if (process.argv[2]) {
	subcommand = process.argv[2]
	args = process.argv.slice(3)
} else {
	const /** @type {{ value: string }} */ { value } = await prompt({
			type: 'select',
			name: 'value',
			message: 'Choose subcommand',
			choices: ['export', 'new', 'fix', 'install', 'repos', 'script'],
		})
	subcommand = value
	args = process.argv.slice(2)
}

if (subcommand === 'export') {
	await runExport(args)
} else if (subcommand === 'new') {
	await runNew(args)
} else if (subcommand === 'fix') {
	await runFix(args)
} else if (subcommand === 'install') {
	await runInstall(args)
} else if (subcommand === 'repos') {
	await runRepos(args)
} else if (subcommand === 'script') {
	await runScript(args)
} else {
	console.error(`Unknown subcommand: "${subcommand}"`)
	process.exit(1)
}
