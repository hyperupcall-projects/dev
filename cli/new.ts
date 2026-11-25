import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import process from 'node:process'

import Handlebars from 'handlebars'
import type { Config } from '#types'
import { fileExists, ignoreDirectories } from '#utilities/util.ts'
import * as clack from '@clack/prompts'

import { existsSync } from 'node:fs'
import {
	ecosystems,
	type EcosystemDefinition,
	type EcosystemId,
} from '#utilities/ecosystems.ts'

export async function run(options: {
	config: Config
	dir?: string
	ecosystem?: string
	templateName?: string
	projectName?: string
	force?: boolean
	options?: string
}) {
	if (!options.dir) {
		const inputValue = await clack.text({
			message: 'Choose a directory',
		})

		if (clack.isCancel(inputValue)) {
			process.exit(1)
		}

		options.dir = inputValue || '.'
	}

	if (!existsSync(options.dir)) {
		const shouldCreate = await clack.confirm({
			message: 'Would you like to create the directory?',
		})

		if (clack.isCancel(shouldCreate)) {
			process.exit(1)
		}

		if (shouldCreate) {
			await fs.mkdir(options.dir, { recursive: true })
		}
	}

	if (!options.ecosystem) {
		const ecosystemChoice = await clack.select({
			message: 'Choose an ecosystem',
			options: (Object.entries(ecosystems) as [EcosystemId, EcosystemDefinition][])
				.filter(([, definition]) => definition.templates)
				.map(([id, definition]) => ({
					label: definition.label,
					value: id,
				})),
		})

		if (clack.isCancel(ecosystemChoice)) {
			process.exit(1)
		}

		options.ecosystem = ecosystemChoice
	}

	if (!options.templateName) {
		if (!(options.ecosystem in ecosystems)) {
			throw new Error(`Ecosystem "${options.ecosystem}" not supported`)
		}

		const parameters = ecosystems?.[options.ecosystem as EcosystemId]?.templates
		if (!parameters) {
			throw new Error(`Ecosystem "${options.ecosystem}" not supported`)
		}

		const value = await clack.select({
			message: `Choose a template`,
			options: Object.entries(parameters).map(([id, { name }]) => ({
				label: name,
				value: id,
			})),
		})

		if (clack.isCancel(value)) {
			process.exit(1)
		}

		options.templateName = value
	}

	if (!options.projectName) {
		const value = await clack.text({
			message: 'What is the project name?',
		})

		if (clack.isCancel(value)) {
			process.exit(1)
		}

		options.projectName = value
	}

	await createProject({
		config: options.config,
		dir: options.dir,
		ecosystem: options.ecosystem,
		templateName: options.templateName,
		projectName: options.projectName,
		forceTemplate: options.force ?? false,
		options: options.options ? options.options.split(',') : [],
	})
}

type Context = Readonly<{
	config: Config
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
				if (ignoreDirectories().includes(dirent.name)) {
					continue
				}

				walk(path.join(dirent.parentPath, dirent.name))
			} else {
				const inputFile = path.join(dirent.parentPath, dirent.name)
				const rel = inputFile.slice(templateDir.length + 1)
				const outputFile = path.join(outputDir, rel)

				try {
					const template = await fs.readFile(inputFile, 'utf-8')
					const outputContent = Handlebars.compile(template)(
						{
							Fullname: ctx.config.fullname,
							fullname: ctx.config.fullname,
							public_email: ctx.config.public_email,
							website: ctx.config.website,
							manifest: ctx.config.manifest,
						},
						{
							helpers: {
								raw: function (options: any) {
									return options.fn()
								},
							},
						},
					)
					await fs.mkdir(path.dirname(outputFile), { recursive: true })
					await fs.writeFile(outputFile, outputContent)
				} catch (err) {
					console.error(`Failed to write template file from input: ${inputFile}`)
				}
			}
		}
	}

	console.info('Done!')
}
