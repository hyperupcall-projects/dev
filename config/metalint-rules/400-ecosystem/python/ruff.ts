import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { parse, type TomlTable } from 'smol-toml'
import type { Issues } from '#types'
import { filesMustHaveContent, filesMustHaveName } from '#utilities/metalint-utils.ts'
import { fileExists, mergeTOML, pkgRoot } from '#utilities/util.ts'

export const issues: Issues = async function* issues() {
	// Check that there is only one configuration file.
	{
		const configFile = '.config/ruff.toml'
		const configContent = await fs.readFile(
			path.join(pkgRoot(), 'config/ruff.toml'),
			'utf-8',
		)

		// https://docs.astral.sh/ruff/configuration/#config-file-discovery
		yield* filesMustHaveName({
			[configFile]: ['ruff.toml'],
		})
		yield* filesMustHaveContent('ruff', {
			[configFile]: configContent,
		})

		if (await fileExists('pyproject.toml')) {
			const pyproject = parse(await fs.readFile('pyproject.toml', 'utf-8'))
			const tool = pyproject.tool as TomlTable | undefined
			const ruff = tool?.ruff as TomlTable | undefined

			if (ruff?.extend !== configFile) {
				yield {
					id: 'pyproject-toml-must-extend-ruff-config',
					message: `Expected pyproject.toml [tool.ruff] to set extend = "${configFile}"`,
					fix: async () => {
						const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dev-ruff-'))
						try {
							const overridePath = path.join(tmpDir, 'override.toml')
							await fs.writeFile(overridePath, `[tool.ruff]\nextend = "${configFile}"\n`)
							const output = await mergeTOML('pyproject.toml', overridePath)
							await fs.writeFile('pyproject.toml', output)
						} finally {
							await fs.rm(tmpDir, { recursive: true, force: true })
						}
					},
				}
			}
		}
	}
}
