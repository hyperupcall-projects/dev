import * as ejs from 'ejs'
import * as path from 'node:path'
import * as url from 'node:url'
import { globby } from 'globby'
import * as fs from 'node:fs/promises'
import { existsSync } from 'node:fs'

/**
 * @param {string} variable
 * @param {any} value
 * @returns {never}
 */
export function badValue(variable, value) {
	console.error(`Unexpected value of ${variable}: ${value}`)
	process.exit(1)
}

export async function printVariations() {}

/**
 * @param {import("./new.js").Context} ctx
 */
export async function templateTemplate(ctx) {
	const templateDirs = []

	{
		const commonDir = path.join(
			// @ts-expect-error
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
				// @ts-expect-error
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
