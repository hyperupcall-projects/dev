import * as fs from 'node:fs/promises'
import type { Issues } from '#types'
import { parse, type TomlTable } from 'smol-toml'

export const issues: Issues = async function* issues() {
	const cargoToml = parse(await fs.readFile('Cargo.toml', 'utf-8'))
	const cargoPackage = cargoToml.package as TomlTable | undefined

	for (const { id, value, message } of [
		{
			id: 'must-have-package-section',
			value: cargoPackage,
			message: '[package] section is required',
		},
		{
			id: 'must-have-package-name',
			value: cargoPackage?.name,
			message: 'package.name is required',
		},
		{
			id: 'must-have-package-edition',
			value: cargoPackage?.edition,
			message: 'package.edition is required',
		},
		{
			id: 'must-have-package-publish',
			value: cargoPackage?.publish,
			message: 'publish is required',
		},
	]) {
		if (value === undefined) {
			yield {
				id,
				message: `Cargo.toml is missing required field: ${message}`,
			}
		}
	}

	const isPublishable = cargoPackage?.publish !== false
	if (isPublishable) {
		const hasLicense = cargoPackage?.license !== undefined
		const hasLicenseFile = cargoPackage?.['license-file'] !== undefined

		if (!hasLicense && !hasLicenseFile) {
			yield {
				id: 'publishable-crate-must-have-license',
				message: `Cargo.toml should specify 'license' or 'license-file' for publishable crates`,
			}
		}

		const hasRepository = cargoPackage?.repository !== undefined
		if (!hasRepository) {
			yield {
				id: 'publishable-crate-must-have-repository',
				message: `Cargo.toml should specify 'repository' for publishable crates`,
			}
		}
	}
}
