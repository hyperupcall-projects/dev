import * as fs from 'node:fs/promises'
import type { Issues } from '#types'
import { fileExists } from '#common'
import dedent from 'dedent'

// TODO
export const issues: Issues = async function* issues({ project }) {
	if (!(await fileExists('Cargo.toml'))) {
		return
	}

	const cargoTomlText = await fs.readFile('Cargo.toml', 'utf-8')

	for (const { pattern, message } of [
		{ pattern: /\[package\]/, message: '[package] section is required' },
		{ pattern: /^name\s*=/m, message: 'package.name is required' },
		{ pattern: /^edition\s*=/m, message: 'package.edition is required' },
	]) {
		if (!pattern.test(cargoTomlText)) {
			yield {
				message: dedent`
					-> Cargo.toml is missing required field: ${message}
				`,
			}
		}
	}

	// Check for recommended edition (2021 is current stable)
	if (/edition\s*=\s*["']201[58]["']/.test(cargoTomlText)) {
		const newContent = cargoTomlText.replace(
			/(edition\s*=\s*["'])201[58](["'])/g,
			'$12021$2',
		)

		yield {
			message: dedent`
				-> Cargo.toml should use edition = "2021" (current stable Rust edition)
			`,
			fix: async () => {
				await fs.writeFile('Cargo.toml', newContent, 'utf-8')
			},
		}
	}

	// Check that publish field is explicitly set
	const hasPublish = /^publish\s*=/m.test(cargoTomlText)
	if (!hasPublish) {
		yield {
			message: dedent`
				-> Cargo.toml should explicitly set 'publish = false' or 'publish = true'
				   to make publishing intent clear
			`,
		}
	}

	// If publish = true (or not false), ensure license and authors/repository are set
	const isPublishable = !/publish\s*=\s*false/.test(cargoTomlText)
	if (isPublishable) {
		const hasLicense = /^license\s*=/m.test(cargoTomlText)
		const hasLicenseFile = /^license-file\s*=/m.test(cargoTomlText)

		if (!hasLicense && !hasLicenseFile) {
			yield {
				message: dedent`
					-> Cargo.toml should specify 'license' or 'license-file' for publishable crates
				`,
			}
		}

		const hasRepository = /^repository\s*=/m.test(cargoTomlText)
		if (!hasRepository) {
			yield {
				message: dedent`
					-> Cargo.toml should specify 'repository' for publishable crates
				`,
			}
		}
	}
}
