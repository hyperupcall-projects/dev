import * as ejs from 'ejs'
import * as path from 'node:path'
import * as url from 'node:url'
import * as util from 'node:util'
import * as os from 'node:os'
import { globby } from 'globby'
import * as fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import watcher from '@parcel/watcher'
import { TEMPLATES } from './util.js'
import { throttle, debounce } from 'lodash-es'
import { newProject } from './new.js'

/**
 * @param {string[]} args
 */
export async function run(args) {
	const { values, positionals } = util.parseArgs({
		args,
		allowPositionals: false,
		options: {
			watch: {
				type: 'boolean',
			},
			help: {
				type: 'boolean',
				short: 'h',
			},
		},
	})

	const templatesDir = path.join(path.dirname(import.meta.dirname), `./config/templates`)
	const outputDir = path.join(
		os.homedir(),
		'Documents/Projects/Programming/Organizations/fox-templates',
	)
	await exportProjects(templatesDir, {
		watch: values.watch ?? false,
		outputDir,
	})
}

/**
 * @typedef Options
 * @property {boolean} watch
 * @property {string} outputDir
 *
 * @param {string} templatesDir
 * @param {Options} options
 */
export async function exportProjects(templatesDir, { watch, outputDir }) {
	if (watch) {
		console.log('Starting watcher...', templatesDir)
		let /** @type {string[]} */ templateDirsToUpdate = []
		const processDirs = debounce(async () => {
			if (templateDirsToUpdate.length > 0) {
				for (const templateDir of Array.from(new Set(templateDirsToUpdate))) {
					await newProject({
						dir: path.join(outputDir, path.basename(templateDir)),
						ecosystem: path.dirname(path.basename(templateDir)),
						variant: path.basename(templateDir),
						name: path.basename(templateDir),
						options: ['noexec'],
					})
				}
				templateDirsToUpdate = []
			}
		}, 200)

		await watcher.subscribe(
			templatesDir,
			async (err, events) => {
				if (err) {
					console.error(err)
					return
				}

				for (const event of events) {
					const [ecosystemName, templateName] = path
						.relative(templatesDir, event.path)
						.split(path.sep)
					const templateDirStat = await fs.stat(
						path.join(templatesDir, ecosystemName, templateName),
					)

					if (
						(templateDirStat.isDirectory() && templateName === 'common') ||
						!templateDirStat.isDirectory()
					) {
						const ecosystemDir = path.join(templatesDir, ecosystemName)
						for (const templateName of await fs.readdir(ecosystemDir, {
							withFileTypes: true,
						})) {
							if (!templateName.isDirectory() || templateName.name === 'common') {
								continue
							}

							const templateDir = path.join(ecosystemDir, templateName.name)
							templateDirsToUpdate.push(templateDir)
						}
					} else {
						const templateDir = path.join(templatesDir, ecosystemName, templateName)
						templateDirsToUpdate.push(templateDir)
					}
				}

				processDirs()
			},
			{
				ignore: ['**/node_modules/**'],
			},
		)
	}
}
