import * as ejs from 'ejs'
import * as path from 'path'
import * as url from 'url'
import { globby } from 'globby'
import * as fs from 'fs/promises'
import { existsSync } from 'fs'

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
 * @param {import("./new.js").Vars} vars
 */
export async function templateTemplate(vars) {
	const templateDirs = []

	{
		const commonDir = path.join(
			// @ts-expect-error
			import.meta.dirname,
			`./templates/${vars.ecosystem}/common`,
		)
		if (existsSync(commonDir)) {
			templateDirs.push(commonDir)
		}
	}
	{
		templateDirs.push(
			path.join(
				// @ts-expect-error
				import.meta.dirname,
				`./templates/${vars.ecosystem}/${vars.ecosystem}-${vars.variant}`,
			),
		)
	}

	for (const templateDir of templateDirs) {
		for (const inputPath of await globby('**/*', { cwd: templateDir, dot: true })) {
			const input = await fs.readFile(path.join(templateDir, inputPath), 'utf-8')

			let output, outputPath
			if (inputPath.endsWith('.ejs')) {
				output = ejs.render(input, { vars })
				outputPath = path.join(vars.dir, inputPath.slice(0, '.ejs'.length * -1))
			} else {
				output = input
				outputPath = path.join(vars.dir, inputPath)
			}

			await fs.mkdir(path.dirname(outputPath), { recursive: true })
			await fs.writeFile(outputPath, output)
		}
	}
}
