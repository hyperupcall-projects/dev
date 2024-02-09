import enquirer from 'enquirer'
import { initRust, runRust } from './ecosystems/rust.js'
import { initNodeJS, runNodeJS } from './ecosystems/nodejs.js'
import { initGo, runGo } from './ecosystems/go.js'
import { initCpp, runCpp } from './ecosystems/cpp.js'
import { parseArgs } from 'node:util'
import { badValue } from './util.js'

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

/**
 * @typedef Vars
 * @property {string} dir
 * @property {string} ecosystem
 * @property {string} variant
 * @property {string} name
 * @property {string[]} options
 * @exports Vars
 */

/** @type {Vars} */
const vars = {
	dir: positionals?.[0] ?? '',
	ecosystem: values.ecosystem ?? '',
	variant: values.variant ?? '',
	name: values.name ?? '',
	options: (values.options ?? '').split(','),
}

if (!vars.ecosystem) {
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
	vars.ecosystem = input.value
}

if (vars.ecosystem === 'nodejs') {
	if (!vars.variant) {
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
		vars.variant = variant
	}

	if (!vars.name) {
		vars.name = await promptProjectName()
	}

	await run(initNodeJS, runNodeJS, vars)
} else if (vars.ecosystem === 'rust') {
	if (!vars.variant) {
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
		vars.variant = variant
	}

	if (!vars.name) {
		vars.name = await promptProjectName()
	}

	await run(initRust, runRust, vars)
} else if (vars.ecosystem === 'go') {
	if (!vars.variant) {
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
		vars.variant = variant
	}

	if (!vars.name) {
		vars.name = await promptProjectName(
			'What is the project name (including GitHub organization)?',
		)
	}

	await run(initGo, runGo, vars)
} else if (vars.ecosystem === 'cpp') {
	if (!vars.variant) {
		const /** @type {{ value: string }} */ { value: variant } = await prompt({
				type: 'select',
				name: 'value',
				message: 'What kind of project is it?',
				choices: [
					{ message: 'Hello World', name: 'hello-world' },
					{ message: 'Playground', name: 'playground' },
				],
			})
		vars.variant = variant
	}

	if (!vars.name) {
		vars.name = await promptProjectName()
	}

	await run(initCpp, runCpp, vars)
} else {
	badValue('ecosystem', vars.ecosystem)
}

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

/**
 * @param {(vars: Vars) => Promise<void>} initFn
 * @param {() => Promise<void>} runFn
 * @param {Vars} vars
 */
async function run(initFn, runFn, vars) {
	if (!vars.dir) {
		vars.dir = vars.name
	}

	await initFn(vars)

	if (!vars.options.includes('noexec')) {
		const /** @type {{ value: string }} */ { value: shouldRun } = await prompt({
				type: 'confirm',
				name: 'value',
				message: 'Would you like to build and execute the project?',
			})

		if (shouldRun) {
			await runFn()
		}
	}

	console.info(`Bootstrapped ${vars.dir}...`)
}
