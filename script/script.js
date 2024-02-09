import enquirer from 'enquirer'
import { parseArgs } from 'node:util'
import * as fs from 'node:fs/promises'
import path from 'node:path'

const { prompt } = enquirer

const { positionals, values } = parseArgs({
	allowPositionals: true,
})

// @ts-expect-error
const scriptsDir = path.join(import.meta.dirname, './scripts')

let scriptName = positionals?.[0]
if (!scriptName) {
	const scriptNames = await fs.readdir(scriptsDir)

	const /** @type {{ value: string }} */ input = await prompt({
			type: 'select',
			name: 'value',
			message: 'Choose a script',
			choices: scriptNames,
		})
	scriptName = input.value
}

const module = await import(path.join(scriptsDir, scriptName))
await module.run({ projectDir: process.cwd() })
