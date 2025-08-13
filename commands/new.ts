import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import { existsSync } from 'node:fs'

import * as ejs from 'ejs'
import { globby } from 'globby'
import { execa } from 'execa'
import Handlebars from 'handlebars'
import { fileExists } from '#common'
import * as inquirer from '@inquirer/prompts'

import type { CommandNewOptions } from '#types'

export async function run(values: CommandNewOptions, positionals: string[]) {
	if (!values.ecosystem) {
		const input = await inquirer.select({
			message: 'Choose an ecosystem',
			choices: [
				{ name: 'Deno', value: 'deno' },
				{ name: 'NodeJS', value: 'nodejs' },
				{ name: 'Rust', value: 'rust' },
				{ name: 'Go', value: 'go' },
				{ name: 'C++', value: 'cpp' },
			],
		})
		values.ecosystem = input
	}

	if (!values.templateName) {
		const templateData = getTemplateData()
		const parameters = templateData[values.ecosystem]?.templates
		if (!parameters) {
			throw new Error(`Ecosystem "${values.ecosystem}" not supported`)
		}

		const value = await inquirer.select({
			message: `Choose a "${values.ecosystem}" template`,
			choices: Object.entries(parameters).map(([id, { name }]) => ({
				name,
				value: id,
			})),
		})

		values.templateName = value
	}

	if (!values.projectName) {
		const value = await inquirer.input({
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

type Context = Readonly<{
	dir: string
	ecosystem: string
	templateName: string
	projectName: string
	forceTemplate: boolean
	options: string[]
}>

export async function createProject(ctx: Context) {
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
	async function walk(dir: string) {
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
				await fs.mkdir(path.dirname(outputFile), { recursive: true })
				await fs.writeFile(outputFile, outputContent)
			}
		}
	}

	console.info(`Bootstrapped "${ctx.templateName}"`)
}

function getTemplateData(): Record<
	string,
	{ templates: Record<string, { name: string }>; onRun?: (ctx: unknown) => Promise<void> }
> {
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
		deno: {
			templates: {
				webframework: {
					name: 'Web Framework',
				},
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
