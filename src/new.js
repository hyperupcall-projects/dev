import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import { existsSync } from 'node:fs'
import enquirer from 'enquirer'
import * as ejs from 'ejs'
import { globby } from 'globby'
import { TEMPLATES } from './util.js'

const { prompt } = enquirer

/**
 * @param {string[]} args
 */
export async function run(args) {
	const { positionals, values } = util.parseArgs({
		args,
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
		values.variant = await setVariant(values.variant, TEMPLATES.nodejs)
		values.name = await setName(values.name)
	} else if (values.ecosystem === 'rust') {
		values.variant = await setVariant(values.variant, TEMPLATES.rust)
		values.name = await setName(values.name)
	} else if (values.ecosystem === 'go') {
		values.variant = await setVariant(values.variant, TEMPLATES.go)
		values.name = await setName(
			values.name,
			'What is the project name (including GitHub organization)?',
		)
	} else if (values.ecosystem === 'cpp') {
		values.variant = await setVariant(values.variant, TEMPLATES.cpp)
		values.name = await setName(values.name)
	} else {
		badValue('ecosystem', values.ecosystem)
	}

	await newProject({
		dir: positionals[0] ?? '.',
		ecosystem: values.ecosystem,
		variant: values.variant,
		name: values.name,
		options: (values.options ?? '').split(','),
	})
}

/**
 * @param {string | undefined} variant
 * @param {Record<string, { name: string }>} variantObject
 * @returns {Promise<string>}
 */
async function setVariant(variant, variantObject) {
	if (!variant) {
		const /** @type {{ value: string }} */ { value: variantName } = await prompt({
				type: 'select',
				name: 'value',
				message: 'What kind of project is it?',
				choices: Object.entries(variantObject).map(([id, { name }]) => ({
					name: id,
					message: name,
				})),
			})
		variant = variantName
	}

	return variant
}

/**
 * @param {string | undefined} name
 * @param {string} [message]
 * @returns {Promise<string>}
 */
async function setName(name, message) {
	if (!name) {
		const /** @type {{ value: string }} */ { value: projectName } = await prompt({
				type: 'input',
				name: 'value',
				message: message ?? 'What is the project name?',
			})

		name = projectName
	}

	return name
}

/**
 * @typedef _Context
 * @property {string} dir
 * @property {string} ecosystem
 * @property {string} variant
 * @property {string} name
 * @property {string[]} options
 *
 * @typedef {Readonly<_Context>} Context
 */

/**
 * @param {Context} ctx
 */
export async function newProject(ctx) {
	const file = path.join(
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

/**
 * @param {string} variable
 * @param {any} value
 * @returns {never}
 */
export function badValue(variable, value) {
	console.error(`Unexpected value of ${variable}: ${value}`)
	process.exit(1)
}

/**
 * @param {import("../src/new.js").Context} ctx
 */
export async function templateTemplate(ctx) {
	const templateDirs = []

	{
		const commonDir = path.join(
			import.meta.dirname,
			`./templates/${ctx.ecosystem}/common`,
		)
		if (existsSync(commonDir)) {
			templateDirs.push(commonDir)
		}
	}
	{
		templateDirs.push(
			path.join(
				import.meta.dirname,
				`./templates/${ctx.ecosystem}/${ctx.ecosystem}-${ctx.variant}`,
			),
		)
	}

	for (const templateDir of templateDirs) {
		for (const inputPath of await globby('**/*', { cwd: templateDir, dot: true })) {
			const input = await fs.readFile(path.join(templateDir, inputPath), 'utf-8')

			let output, outputPath
			if (inputPath.endsWith('.ejs')) {
				output = ejs.render(input, { ctx })
				outputPath = path.join(ctx.dir, inputPath.slice(0, '.ejs'.length * -1))
			} else {
				output = input
				outputPath = path.join(ctx.dir, inputPath)
			}

			await fs.mkdir(path.dirname(outputPath), { recursive: true })
			await fs.writeFile(outputPath, output)
		}
	}
}
