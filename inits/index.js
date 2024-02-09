import enquirer from 'enquirer'
import { initRust, runRust } from './rust.js'
import { initJavaScript, runJavaScript } from './javascript.js'
import { initGo, runGo } from './go.js'

// TODO: Web server, daemon, cli, library, gui

const { prompt } = enquirer

const /** @type {{ value: string }} */ input = await prompt({
		type: 'select',
		name: 'value',
		message: 'Choose a project to initialize',
		choices: [
			{ message: 'JavaScript', name: 'javascript' },
			{ message: 'Rust', name: 'rust' },
			{ message: 'Go', name: 'go' },
		],
	})

if (input.value === 'javascript') {
	const projectName = await promptProjectName()
	const /** @type {{ value: string }} */ { value: projectVariant } = await prompt({
			type: 'select',
			name: 'value',
			message: 'What kind of project is it?',
			choices: [
				{ message: 'Hello World', name: 'hello-world' },
				{ message: 'CLI', name: 'cli' },
				{ message: 'Web Server', name: 'web-server' },
			],
		})
	await initJavaScript({ projectName, projectVariant })
	await maybeRun(runJavaScript)
} else if (input.value === 'rust') {
	const projectName = await promptProjectName()
	const /** @type {{ value: string }} */ { value: projectVariant } = await prompt({
			type: 'select',
			name: 'value',
			message: 'What kind of project is it?',
			choices: [
				{ message: 'Hello World', name: 'hello-world' },
				{ message: 'CLI', name: 'cli' },
				{ message: 'GUI', name: 'gui' },
			],
		})
	await initRust({ projectName, projectVariant })
	await maybeRun(runRust)
} else if (input.value === 'go') {
	const projectSlug = await promptProjectName(
		'What is the project name (including GitHub organization)?',
	)
	const /** @type {{ value: string }} */ { value: projectVariant } = await prompt({
			type: 'select',
			name: 'value',
			message: 'What kind of project is it?',
			choices: [
				{ message: 'Hello World', name: 'hello-world' },
				{ message: 'CLI', name: 'cli' },
				{ message: 'Web Server', name: 'web-server' },
			],
		})
	await initGo({ projectSlug, projectVariant })
	await maybeRun(runGo)
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
 * @param {() => Promise<void>} fn
 */
async function maybeRun(fn) {
	const /** @type {{ value: string }} */ { value: shouldRun } = await prompt({
			type: 'confirm',
			name: 'value',
			message: 'Would you like to build and execute the project?',
		})

	if (shouldRun) {
		await fn()
	}
}
