import * as ejs from 'ejs'
import * as path from 'node:path'
import * as url from 'node:url'
import { globby } from 'globby'
import * as fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import watcher from '@parcel/watcher'

if (values.export) {
	await exportTemplates(values.export ?? false)
} else {
	await import('../new/new.js')
}

/**
 *
 * @param {boolean} watch
 */
export async function exportTemplates(watch) {
	const templatesDir = path.join(
		// @ts-expect-error
		import.meta.dirname,
		`./templates`,
	)

	for (const ecosystemName of await fs.readdir(templatesDir)) {
		for (const ecosystemDir of await fs.readdir(path.join(templatesDir, ecosystemName))) {
			const templateDir = path.join(templatesDir, ecosystemName, ecosystemDir)
			if (!ecosystemDir.startsWith(ecosystemName)) {
				continue
			}

			console.log(ecosystemDir)
		}
	}

	if (watch) {
		console.log('Starting watcher...', templatesDir)
		await watcher.subscribe(
			templatesDir,
			(err, events) => {
				if (err) {
					console.error(err)
					return
				}

				new Promise(async (resolve, reject) => {
					try {
						const templateDirsToUpdate = []
						for (const event of events) {
							const relPath = path.relative(templatesDir, event.path)
							const [ecosystemName, templateName] = relPath.split(path.sep)
							const ecosystemDir = path.join(templatesDir, ecosystemName)

							if (templateName === 'common') {
								for (const templateName of await fs.readdir(ecosystemDir)) {
									templateDirsToUpdate.push(path.join(ecosystemDir, templateName))
								}
							} else {
								templateDirsToUpdate.push(path.join(ecosystemDir, templateName))
							}

							console.log(event)
							console.log()
						}

						for (const templateDir of templateDirsToUpdate) {
							console.log(templateDir)
						}
						resolve(null)
					} catch (err) {
						reject(err)
					}
				}).catch((err) => console.error(err))
			},
			{
				ignore: ['**/node_modules/**'],
			},
		)
	}
}
