import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { execa } from 'execa'
import Handlebars from 'handlebars'
import { fileExists } from '#common'
import * as inquirer from '@inquirer/prompts'

import type { CommandNewOptions } from '#types'
import { existsSync } from 'node:fs'

const _dirname = import.meta.dirname

export async function run(options: CommandNewOptions, positionals: string[]) {
	if (!positionals[0]) {
		const input = await inquirer.input({
			message: 'Choose a directory',
		})
		positionals = [input]
	}

	if (!existsSync(positionals[0])) {
		const input = await inquirer.confirm({
			message: 'Would you like to create the directory?',
		})

		if (input) {
			await fs.mkdir(positionals[0], { recursive: true })
		}
	}

	if (!options.ecosystem) {
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
		options.ecosystem = input
	}

	if (!options.templateName) {
		const templateData = getTemplateData()
		const parameters = templateData[options.ecosystem]?.templates
		if (!parameters) {
			throw new Error(`Ecosystem "${options.ecosystem}" not supported`)
		}

		const value = await inquirer.select({
			message: `Choose a template`,
			choices: Object.entries(parameters).map(([id, { name }]) => ({
				name,
				value: id,
			})),
		})

		options.templateName = value
	}

	if (!options.projectName) {
		const value = await inquirer.input({
			message: 'What is the project name?',
		})

		options.projectName = value
	}

	await createProject({
		dir: positionals[0] ?? '.',
		ecosystem: options.ecosystem,
		templateName: options.templateName,
		projectName: options.projectName,
		forceTemplate: options.force ?? false,
		options: (options.options ?? '').split(','),
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
	if (!_dirname) throw new TypeError('Variable "import.meta.dirname" is not truthy')

	const outputDir = path.resolve(Deno.cwd(), ctx.dir)

	if (!(await fileExists(outputDir))) {
		await fs.mkdir(outputDir, { recursive: true })
	}

	if (!ctx.forceTemplate) {
		if ((await fs.readdir(outputDir)).length > 0) {
			console.error(`Error: Directory must be empty: "${outputDir}"`)
			Deno.exit(1)
		}
	}

	const templateDir = path.join(
		_dirname,
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

				try {
					const template = await fs.readFile(inputFile, 'utf-8')
					const runtimeTemplate = Handlebars.compile(template)
					const outputContent = runtimeTemplate({
						key: 'value',
					}, {
						helpers: {
							'raw': function (options: any) {
								return options.fn()
							},
						},
					})
					await fs.mkdir(path.dirname(outputFile), { recursive: true })
					await fs.writeFile(outputFile, outputContent)
				} catch (err) {
					console.error(`Failed to template file "${inputFile}"`)
					throw err
				}
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
				'web-server-express': {
					name: 'Web Server (Express)',
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
		},
	}
}
