import type { Issues } from '#types'
import { fileExists, filesMustHaveContent, filesMustHaveName } from '#common'
import * as yaml from 'yaml'
import { execa } from 'execa'
import * as fs from 'node:fs/promises'

export const issues: Issues = async function* issues() {
	// Check that there is only one configuration file.
	{
		// https://lefthook.dev/configuration/index.html#config-file-name
		yield* filesMustHaveName({
			'.lefthook.yaml': ['.lefthook.yml', 'lefthook.yaml', 'lefthook.yml'],
		})

		yield* filesMustHaveContent({
			'.lefthook.toml': null,
			'.lefthook.json': null,
			'lefthook.toml': null,
			'lefthook.json': null,
		})

		if (!(await fileExists('.lefthook.yaml'))) {
			yield {
				message: [`Expected to find a ".lefthook.yaml" file`],
				fix: () =>
					fs.writeFile(
						'.lefthook.yaml',
						`assert_lefthook_installed: true\n`,
						'utf-8',
					),
			}
		}
	}

	// Check that lefthook is activated for the current project.
	{
		if (!(await fileExists('.git/info/lefthook.checksum'))) {
			yield {
				message: [`Expected lefthook to be activated for current project`],
				fix: () => execa`lefthook install`,
			}
		}
	}

	type LefthookConfig = { assert_lefthook_installed: boolean }
	// Check that specific values are set.
	{
		const lefthookConfig = yaml.parse(
			await fs.readFile('.lefthook.yaml', 'utf-8'),
		)
		if (typeof lefthookConfig !== 'object' || lefthookConfig === null) {
			yield {
				message: [`Expected ".lefthook.yaml" to contain an object`],
			}
		}
		if (lefthookConfig.assert_lefthook_installed != true) {
			yield {
				message: [
					`Expected to find property "assert_lefthook_installed" set to "true"`,
				],
			}
		}
	}
}
