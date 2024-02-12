#!/usr/bin/env node
import enquirer from 'enquirer'

const { prompt } = enquirer

if (process.argv[2] === 'export') {
	await import('./export.js')
} else if (process.argv[2] === 'fix') {
	await import('./fix.js')
} else if (process.argv[2] === 'new') {
	await import('./new.js')
} else {
	const /** @type {{ value: string }} */ { value: subcommand } = await prompt({
			type: 'select',
			name: 'value',
			message: 'Choose subcommand',
			choices: ['export', 'fix', 'new'],
		})

	if (subcommand === 'export') {
		await import('./export.js')
	} else if (subcommand === 'fix') {
		await import('./fix.js')
	} else if (subcommand === 'new') {
		await import('./new.js')
	}
}
