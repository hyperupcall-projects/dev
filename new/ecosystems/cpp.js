import { execa } from 'execa'
import { writeTrees } from '../../fix/util/util.js'
import dedent from 'dedent'
import { badValue, templateTemplate } from '../util.js'

/**
 * @typedef {import('../new.js').Vars} Vars
 *
 * @param {Vars} vars
 */
export async function initCpp(vars) {
	if (vars.variant === 'hello-world') {
		await initHelloWorld(vars)
	} else if (vars.variant === 'playground') {
		await initPlayground(vars)
	} else {
		badValue('variant', vars.variant)
	}
}

export async function runCpp() {
	await execa('c++', ['run', '.'], {
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
async function initPlayground(vars) {
	await templateTemplate(vars)
}
