#!/usr/bin/env node
import enquirer from 'enquirer'

const { prompt } = enquirer

if (process.argv[2] === 'new') {
	await import('../new/new.js')
} else if (process.argv[2] === 'fix') {
	await import('../fix/fix.js')
} else {
	const /** @type {{ value: string }} */ { value: subcommand } = await prompt({
			type: 'select',
			name: 'value',
			message: 'Choose a project to initialize',
			choices: ['new', 'fix'],
		})

	if (subcommand === 'new') {
		await import('../new/new.js')
	} else if (subcommand === 'fix') {
		await import('../fix/fix.js')
	}
}
