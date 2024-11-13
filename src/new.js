import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import { existsSync } from 'node:fs'
import enquirer from 'enquirer'
import * as ejs from 'ejs'
import { globby } from 'globby'
import { execa } from 'execa'
import Handlebars from 'handlebars'
import { fileExists } from '../config/common.js'

/**
 * @import { CommandNewOptions } from '../index.js'
 */

const { prompt } = enquirer

export async function run(
	/** @type {CommandNewOptions} */ values,
	/** @type {string[]} */ positionals,
) {
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

	if (!values.templateName) {
		const templateData = getTemplateData()
		const parameters = templateData[values.ecosystem].templates
		if (!parameters) {
			throw new Error(`Ecosystem "${values.ecosystem}" not supported`)
		}

		const /** @type {{ value: string }} */ { value } = await prompt({
				type: 'select',
				name: 'value',
				message: `Choose a "${values.ecosystem}" template`,
				choices: Object.entries(parameters).map(([id, { name }]) => ({
					name: id,
					message: name,
				})),
			})

		values.templateName = value
	}

	if (!values.projectName) {
		const /** @type {{ value: string }} */ { value } = await prompt({
				type: 'input',
				name: 'value',
				message: 'What is the project name?',
			})

		values.projectName = value
	}

	await createProject({
		dir: positionals[0] ?? '.',
		ecosystem: values.ecosystem,
		templateName: values.templateName,
		projectName: values.projectName,
		forceTemplate: values.force,
		options: (values.options ?? '').split(','),
	})
}

/**
 * @typedef _Context
 * @property {string} dir
 * @property {string} ecosystem
 * @property {string} templateName
 * @property {string} projectName
 * @property {boolean} forceTemplate
 * @property {string[]} options
 *
 * @typedef {Readonly<_Context>} Context
 */

export async function createProject(/** @type {Context} */ ctx) {
	const outputDir = path.resolve(process.cwd(), ctx.dir)

	if (!(await fileExists(outputDir))) {
		await fs.mkdir(outputDir, { recursive: true })
	}

	if (!ctx.forceTemplate) {
		if ((await fs.readdir(outputDir)).length > 0) {
			console.error(`Error: Directory must be empty: "${outputDir}"`)
			process.exit(1)
		}
	}

	const templateDir = path.join(
		import.meta.dirname,
		'../config/templates',
		ctx.ecosystem,
		`${ctx.ecosystem}-${ctx.templateName}`,
	)

	await walk(templateDir)
	async function walk(/** @type {string} */ dir) {
		for (const dirent of await fs.readdir(dir, { withFileTypes: true })) {
			if (dirent.isDirectory()) {
				if (['node_modules', '__pycache__'].includes(dirent.name)) {
					continue
				}

				walk(path.join(dirent.parentPath, dirent.name))
			} else {
				const inputFile = path.join(dirent.parentPath, dirent.name)
				const rel = inputFile.slice(templateDir.length + 1)
				const outputFile = path.join(outputDir, rel)

				let outputContent = ''
				{
					const template = await fs.readFile(inputFile, 'utf-8')
					const runtimeTemplate = Handlebars.compile(template)
					outputContent = runtimeTemplate({
						key: 'value',
					})
				}
				await fs.writeFile(outputFile, outputContent)
			}
		}
	}

	console.info(`Bootstrapped "${ctx.templateName}"`)
}

function getTemplateData() {
	return {
		nodejs: {
			templates: {
				'hello-world': {
					name: 'Hello World',
				},
				cli: {
					name: 'CLI',
				},
				'web-server': {
					name: 'Web Server',
				},
			},
			async onRun(ctx) {
				await execa('npm', ['run', 'start'], {
					stdio: 'inherit',
				})
			},
		},
		rust: {
			templates: {
				'hello-world': {
					name: 'Hello World',
				},
				cli: {
					name: 'CLI',
				},
				gui: {
					name: 'GUI',
				},
			},
			async onRun(ctx) {
				await execa('cargo', ['run'], {
					stdio: 'inherit',
				})
			},
		},
		go: {
			templates: {
				'hello-world': {
					name: 'Hello World',
				},
				cli: {
					name: 'CLI',
				},
				'web-server': {
					name: 'Web Server',
				},
			},
			async onRun(ctx) {
				await execa('go', ['mod', 'init', `github.com/${ctx.name}`], {
					stdio: 'inherit',
				})
			},
		},
		cpp: {
			templates: {
				'hello-world': {
					name: 'Hello World',
				},
				playground: {
					name: 'Playground',
				},
			},
			async onRun(ctx) {
				await execa('c++', ['run', '.'], {
					stdio: 'inherit',
				})
			},
		},
	}
}
