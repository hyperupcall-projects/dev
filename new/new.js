import * as fs from 'node:fs/promises'
import path from 'node:path'
import enquirer from 'enquirer'
import { templateTemplate } from './util.js'

const { prompt } = enquirer

/**
 * @typedef _Context
 * @property {string} dir
 * @property {string} ecosystem
 * @property {string} variant
 * @property {string} name
 * @property {string[]} options
 *
 * @typedef {Readonly<_Context>} Context
 *
 * @param {Context} ctx
 */
export async function newTemplate(ctx) {
	const file = path.join(
		// @ts-expect-error
		import.meta.dirname,
		'templates',
		ctx.ecosystem,
		ctx.ecosystem + '.js',
	)

	let initFn = null
	let runFn = null
	if (
		await fs
			.stat(file)
			.then(() => true)
			.catch(() => false)
	) {
		const module = await import(file)
		initFn = module.init ?? defaultInitFn
		runFn = module.run ?? defaultRunFn
	} else {
		initFn = defaultInitFn
		runFn = defaultRunFn
	}

	await initFn(ctx)

	if (!ctx.options.includes('noexec')) {
		const /** @type {{ value: string }} */ { value: shouldRun } = await prompt({
				type: 'confirm',
				name: 'value',
				message: 'Would you like to build and execute the project?',
			})

		if (shouldRun) {
			await runFn()
		}
	}

	console.info(`Bootstrapped ${ctx.dir}...`)
}

/**
 * @param {Context} ctx
 */
async function defaultInitFn(ctx) {
	await templateTemplate(ctx)
}

/**
 * @param {Context} ctx
 */
function defaultRunFn(ctx) {}
