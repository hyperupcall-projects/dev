import { globby } from 'globby'
import fs from 'node:fs/promises'
import type { PackageJson } from 'type-fest'

export async function getEcosystems(rootDir: string): Promise<string[]> {
	using _ = ((origDir: string) => ({
		[Symbol.dispose]: () => process.chdir(origDir),
	}))(process.cwd())
	process.chdir(rootDir)

	const ecosystems: string[] = []

	if (await fileExists('package.json')) {
		ecosystems.push('nodejs')

		const content: PackageJson = JSON.parse(
			await fs.readFile('package.json', 'utf-8'),
		)
		if (content.displayName) {
			ecosystems.push('vscode-extension')
		}
	}

	if ((await fileExists('process.jsonc')) || (await fileExists('process.json'))) {
		ecosystems.push('deno')
	}

	if ((await globby('*.c')).length > 0) {
		ecosystems.push('c')
	}

	// https://cmake.org/cmake/help/latest/command/project.html
	if (await fileExists('CMakeLists.txt')) {
		const content = await fs.readFile('CMakeLists.txt', 'utf-8')
		const language = content.match(
			/project\((?:.*? (?<lang>[a-zA-Z]+)\)|.*?LANGUAGES[ \t]+(?<lang>[a-zA-Z]+))/,
		)
		if (language?.groups?.lang === 'C') {
			ecosystems.push('c')
		} else if (language?.groups?.lang === 'CXX') {
			ecosystems.push('cpp')
		} else {
			// TODO
			console.error(
				`CMAkeLists.txt should have language defined in project()`,
			)
			process.exit(1)
		}
	}

	if (await fileExists('basalt.toml')) {
		ecosystems.push('bash')
	}

	// https://zed.dev/docs/extensions/developing-extensions
	if (await fileExists('extension.toml')) {
		ecosystems.push('zed-extension')
	}

	return ecosystems
}

async function fileExists(filepath: string): Promise<boolean> {
	return await fs
		.stat(filepath)
		.then(() => true)
		.catch(() => false)
}
