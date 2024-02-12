#!/usr/bin/env node
import { parseArgs } from 'node:util'
import enquirer from 'enquirer'
import { newTemplate } from '../new/new.js'
import { badValue } from '../new/util.js'

const { prompt } = enquirer

const { positionals, values } = parseArgs({
	allowPositionals: true,
	options: {
		ecosystem: {
			type: 'string',
		},
		variant: {
			type: 'string',
		},
		name: {
			type: 'string',
		},
		options: {
			type: 'string',
		},
	},
})

if (!values.ecosystem) {
	const /** @type {{ value: string }} */ input = await prompt({
			type: 'select',
			name: 'value',
			message: 'Choose an ecosystem',
			choices: [
				{ message: 'NodeJS', name: 'nodejs' },
				{ message: 'Rust', name: 'rust' },
				{ message: 'Go', name: 'go' },
				{ message: 'C++', name: 'cpp' },
			],
		})
	values.ecosystem = input.value
}

if (values.ecosystem === 'nodejs') {
	if (!values.variant) {
		const /** @type {{ value: string }} */ { value: variant } = await prompt({
				type: 'select',
				name: 'value',
				message: 'What kind of project is it?',
				choices: [
					{ message: 'Hello World', name: 'hello-world' },
					{ message: 'CLI', name: 'cli' },
					{ message: 'Web Server', name: 'web-server' },
				],
			})
		values.variant = variant
	}

	if (!values.name) {
		values.name = await promptProjectName()
	}
} else if (values.ecosystem === 'rust') {
	if (!values.variant) {
		const /** @type {{ value: string }} */ { value: variant } = await prompt({
				type: 'select',
				name: 'value',
				message: 'What kind of project is it?',
				choices: [
					{ message: 'Hello World', name: 'hello-world' },
					{ message: 'CLI', name: 'cli' },
					{ message: 'GUI', name: 'gui' },
				],
			})
		values.variant = variant
	}

	if (!values.name) {
		values.name = await promptProjectName()
	}
} else if (values.ecosystem === 'go') {
	if (!values.variant) {
		const /** @type {{ value: string }} */ { value: variant } = await prompt({
				type: 'select',
				name: 'value',
				message: 'What kind of project is it?',
				choices: [
					{ message: 'Hello World', name: 'hello-world' },
					{ message: 'CLI', name: 'cli' },
					{ message: 'Web Server', name: 'web-server' },
				],
			})
		values.variant = variant
	}

	if (!values.name) {
		values.name = await promptProjectName(
			'What is the project name (including GitHub organization)?',
		)
	}
} else if (values.ecosystem === 'cpp') {
	if (!values.variant) {
		const /** @type {{ value: string }} */ { value: variant } = await prompt({
				type: 'select',
				name: 'value',
				message: 'What kind of project is it?',
				choices: [
					{ message: 'Hello World', name: 'hello-world' },
					{ message: 'Playground', name: 'playground' },
				],
			})
		values.variant = variant
	}

	if (!values.name) {
		values.name = await promptProjectName()
	}
} else {
	badValue('ecosystem', values.ecosystem)
}

// TODO: badvalue for variant and name

await newTemplate({
	dir: positionals[0] ?? '.',
	ecosystem: values.ecosystem,
	variant: values.variant,
	name: values.name,
	options: (values.options ?? '').split(','),
})

/**
 * @param {string} [message]
 */
async function promptProjectName(message) {
	const /** @type {{ value: string }} */ { value: projectName } = await prompt({
			type: 'input',
			name: 'value',
			message: message ?? 'What is the project name?',
		})

	return projectName
}
