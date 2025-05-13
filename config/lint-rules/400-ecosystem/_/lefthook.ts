import type { Issues } from '#types'
import { fileExists, filesMustHaveContent, filesMustHaveShape } from '#common'
import * as yaml from 'std/yaml'
import { execa } from 'execa'

export const issues: Issues = async function* issues({ project }) {
	// Check that there is only one configuration file.
	{
		// https://lefthook.dev/configuration/index.html#config-file-name
		yield* filesMustHaveContent({
			'lefthook.yml': null,
			'.lefthook.yml': null,
			'lefthook.yaml': null,
			'lefthook.toml': null,
			'.lefthook.toml': null,
			'lefthook.json': null,
			'.lefthook.json': null,
		})
	}

	// Check that lefthook is activated for the current project.
	{
		if (!await fileExists('.git/info/lefthook.checksum')) {
			yield {
				message: [
					`Expected lefthook to be activated for current project`,
				],
				fix: async () => execa`lefthook install`,
			}
		}
	}

	// Check that specific values are set.
	{
		const lefthookConfig = yaml.parse(await Deno.readTextFile('.lefthook.yaml')) as Record<
			PropertyKey,
			unknown
		>
		if (!('pre-commit' in lefthookConfig)) {
			yield {
				message: [
					`Expected to find property "pre-commit" in file "./.lefthook.yaml"`,
				],
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
