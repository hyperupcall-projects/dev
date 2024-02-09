import { execa } from 'execa'
import { badValue, templateTemplate } from '../util.js'

/**
 * @typedef {import('../new.js').Vars} Vars
 *
 * @param {Vars} vars
 */
export async function initNodeJS(vars) {
	if (vars.variant === 'hello-world') {
		await initHelloWorld(vars)
	} else if (vars.variant === 'cli') {
		await initCli(vars)
	} else if (vars.variant === 'web-server-express') {
		await initWebServer(vars)
	} else {
		badValue('variant', vars.variant)
	}
}

export async function runNodeJS() {
	await execa('npm', ['run', 'start'], {
		stdin: 'inherit',
		stdout: 'inherit',
		stderr: 'inherit',
	})
}

/**
 * @param {Vars} vars
 */
async function initHelloWorld(vars) {
	await templateTemplate(vars)
}

/**
 * @param {Vars} vars
 */
async function initCli(vars) {}

/**
 * @param {Vars} vars
 */
async function initWebServer(vars) {}
