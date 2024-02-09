import { execa } from 'execa'

/**
 * @typedef Options
 * @property {string} projectName
 * @property {string} projectVariant
 *
 * @param {Options} opts
 */
export async function initJavaScript(opts) {
	if (opts.projectVariant === 'hello-world') {
		await initHelloWorld(opts)
	} else if (opts.projectVariant === 'cli') {
		await initCli(opts)
	} else if (opts.projectVariant === 'web-server') {
		await initWebServer(opts)
	}
}

export async function runJavaScript() {
	await execa('npm', ['run', 'start'], {
		stdin: 'inherit',
		stdout: 'inherit',
		stderr: 'inherit',
	})
}

/**
 * @param {Options} opts
 */
async function initHelloWorld(opts) {}

/**
 * @param {Options} opts
 */
async function initCli(opts) {}

/**
 * @param {Options} opts
 */
async function initWebServer(opts) {}
