import * as fs from 'node:fs/promises'
import process from 'node:process'
import { styleText } from 'node:util'
import { SelectPrompt, wrapTextWithPrefix } from '@clack/core'
import * as clack from '@clack/prompts'
import { Table } from 'console-table-printer'
import ansiEscapes from 'ansi-escapes'
import spdxLicenseList from 'spdx-license-list/full.js'

type LicenseOption<Value extends string = string> = clack.Option<Value> & {
	value: Value
	note?: string
}

const licenseOptions = {
	software: {
		permissive: [
			{
				label: 'ISC License ★',
				value: 'ISC',
				note: 'Shortest.'
			},
			{
				label: 'MIT License',
				value: 'MIT',
				note: 'Like ISC, but longer.'
			},
			{
				label: 'BSD 2-Clause "Simplified" License',
				value: 'BSD-2-Clause',
				note: 'Like ISC, but longer.'
			},
			{
				label: 'BSD 3-Clause "New" or "Revised" License ★',
				value: 'BSD-3-Clause',
				note: 'Cannot use author names for endorsement.'
			},
			{
				label: 'Boost Software License 1.0',
				value: 'BSL-1.0',
				note: 'Waives requirement to include license if distributing binary file.'
			},
			{
				label: 'zlib License',
				value: 'Zlib',
				note: 'Cannot misrepresent original authorship; altered source versions must be marked as such.'
			},
			{
				label: 'Apache License 2.0',
				value: 'Apache-2.0',
				note: 'Very long; explicitly protects against patents.'
			},
			{
				label: 'BSD Zero Clause License',
				value: '0BSD',
				note: 'Based on ISC, without preservation of copyright and license notice.'
			},
		],
		'weak-copyleft': [
			{
				label: 'Mozilla Public License 2.0 ★',
				value: 'MPL-2.0',
				note: 'File-level copyleft.'
			},
			{
				label: 'Eclipse Public License 2.0',
				value: 'EPL-2.0',
				note: 'Module-level copyleft.'
			},
			{
				label: 'GNU Lesser GPL v2.1',
				value: 'LGPL-2.1-only',
				note: 'Library-level copyleft. So, proprietary applications can dynamically link against work. '
			},
			{
				label: 'GNU Lesser GPL v3.0',
				value: 'LGPL-3.0-only',
				note: 'Like LGPL v2.1, but compatible with Apache 2.0 and adds patent clauses. Rewritten as an extension of GPL v3.0. Has Anti-Tivoization clause.'
			},

		],
		'strong-copyleft': [
			{
				label: 'GNU GPL v2.0',
				value: 'GPL-2.0-only',
			},
			{
				label: 'GNU GPL v3.0 ★',
				value: 'GPL-3.0-only',
				note: 'Like GPL v2.0, but compatible with Apache 2.0 and adds patent clauses. Has Anti-Tivoization clause.'
			},
			{
				label: 'GNU Affero GPL v3.0',
				value: 'AGPL-3.0-only',
				note: 'Like GPL v3.0, but includes network interaction/SaaS loophole.'
			},
		],
	},
	content: [
		{
			label: 'CC Zero v1.0 Universal',
			value: 'CC0-1.0',
			note: 'CC0'
		},
		{
			label: 'CC Attribution 4.0 Intl.',
			value: 'CC-BY-4.0',
			note: 'CC BY'
		},
		{
			label: 'CC Attribution-ShareAlike 4.0 Intl.',
			value: 'CC-BY-SA-4.0',
			note: 'CC BY-SA'
		},
		{
			label: 'CC Attribution-NoDerivatives 4.0 Intl',
			value: 'CC-BY-ND-4.0',
			note: 'CC BY-ND'
		},
		{
			label: 'CC Attribution-NonCommercial 4.0 Intl.',
			value: 'CC-BY-NC-4.0',
			note: 'CC BY-NC'
		},
		{
			label:
				'CC Attribution-NonCommercial-ShareAlike 4.0 Intl. ★',
			value: 'CC-BY-NC-SA-4.0',
			note: 'CC BY-NC-SA'
		},
		{
			label:
				'CC Attribution-NonCommercial-NoDerivatives 4.0 Intl.',
			value: 'CC-BY-NC-ND-4.0',
			note: 'CC BY-NC-ND'
		}
	],
	datasets: [
		{
			label: 'ODC Public Domain Dedication & License 1.0',
			value: 'PDDL-1.0',
			note: 'No attribution required.',
		},
		{
			label: 'ODC Attribution License v1.0',
			value: 'ODC-By-1.0',
			note: 'Attribution required.',
		},
		{
			label: 'ODC Open Database License v1.0 ★',
			value: 'ODbL-1.0',
			note: 'Attribution required; modifications must use same license; if using a derivative publically, must share database. If database is within a collective database/larger work, relicensing collective database not required.',
		},
	],
	font: [
		{
			label: 'SIL Open Font License 1.1 ★',
			value: 'OFL-1.1',
			note: 'Font itself or derivaties cannot be sold by itself and derivatives cannot clash with reserved font names. Can be bundled with software.'
		},
		{
			label: 'GNU GPL v2.0 with Font exception',
			value: 'GPL-2.0-with-font-exception',
			note: 'Has exception to allow embedding in document without forcing document to change license. Otherwise, if bundled with larger work, larger work must licensed under GPL.',
		}
	],
} as const

function linkLicenseName(name: string, licenseId: string) {
	if (!name || !Object.hasOwn(spdxLicenseList, licenseId)) return name
	return styleText(
		'underline',
		ansiEscapes.link(
			name,
			`https://spdx.org/licenses/${encodeURIComponent(licenseId)}.html`,
		),
	)
}

async function selectLicenseTable<Value extends string>({ message, options }: {
	message: string
	options: readonly LicenseOption<Value>[]
}): Promise<Value | typeof clack.CANCEL_SYMBOL> {
	const result = await new SelectPrompt({
		options: [...options],
		render() {
			const selected = this.options[this.cursor]
			const bar = styleText('gray', clack.S_BAR)
			const header = [
				bar,
				wrapTextWithPrefix(
					process.stdout,
					message,
					`${clack.symbolBar(this.state)}  `,
					`${clack.symbol(this.state)}  `,
				),
			].join('\n')
			if (this.state === 'submit' || this.state === 'cancel') {
				const answer = wrapTextWithPrefix(
					process.stdout,
					styleText(
						this.state === 'cancel' ? ['strikethrough', 'dim'] : 'dim',
						linkLicenseName(selected.label ?? selected.value, selected.value),
					),
					`${bar}  `,
				)
				return `${header}\n${answer}${this.state === 'cancel' ? `\n${bar}` : ''}`
			}

			const guide = `${styleText('cyan', clack.S_BAR)}  `
			const columns = (process.stdout.columns ?? 80) - 3
			// Reserve seven columns for the table's borders and cell padding.
			const nameWidth = Math.max(4, Math.floor((columns - 7) * 0.6))
			const noteWidth = Math.max(4, columns - 7 - nameWidth)
			const table = new Table({
				shouldDisableColors: true,
				columns: [
					{
						name: 'name',
						title: 'Name',
						alignment: 'left',
						minLen: nameWidth,
						maxLen: nameWidth,
					},
					{
						name: 'note',
						title: 'Note',
						alignment: 'left',
						minLen: noteWidth,
						maxLen: noteWidth,
					},
				],
			})
			// Break long words too, so neither column can push past the terminal.
			const fitCell = (text: string, width: number) =>
				text.replace(new RegExp(`(\\S{${width}})(?=\\S)`, 'gu'), '$1 ')
			const rows = this.options.map((option) => {
				table.clearRows().addRow({
					name: fitCell(`  ${option.label ?? option.value}`, nameWidth),
					note: fitCell(option.note ?? '', noteWidth),
				})
				// Add links after wrapping so hidden URLs do not affect column widths.
				// Keep each wrapped license together as one selectable row.
				return table
					.render()
					.split('\n')
					.slice(3, -1)
					.map((line) =>
						line.replace(
							/^│(\s*)(.*?)(\s*)│/u,
							(_, before, name, after) =>
								`│${before}${linkLicenseName(name, option.value)}${after}│`,
						),
					)
					.join('\n')
			})
			const [top, headings, divider, ...body] = table.render().split('\n')
			const footer = clack.formatInstructionFooter(
				process.stdout,
				clack.SELECT_INSTRUCTIONS,
				true,
			)
			return [
				header,
				...[
					top,
					headings,
					divider,
					...clack.limitOptions({
						options: rows,
						cursor: this.cursor,
						columnPadding: 3,
						rowPadding: header.split('\n').length + 5 + footer.length,
						style: (row, active) =>
							active
								? row.replace('│   ', '│ › ')
									.split('\n')
									.map((line) => styleText('cyan', line))
									.join('\n')
								: row,
					}),
					body.at(-1),
				].map((line) => `${guide}${line}`),
				...footer,
				'',
			].join('\n')
		},
	}).prompt()
	return result ?? clack.CANCEL_SYMBOL
}

export async function writeLicense() {
	const licenseType = await clack.select<keyof typeof licenseOptions>({
		message: 'Choose a license type:',
		options: ([
			{ label: 'Software', value: 'software' },
			{ label: 'Content', value: 'content' },
			{ label: 'Datasets', value: 'datasets' },
			{ label: 'Font', value: 'font' },
		] as const).map((option) => ({
			...option,
			label: linkLicenseName(option.label, option.value),
		})),
	})

	if (clack.isCancel(licenseType)) {
		process.exit(1)
	}

	let options: readonly LicenseOption[]
	if (licenseType === 'software') {
		const category = await clack.select<keyof typeof licenseOptions.software>({
			message: 'Choose a software license category:',
			options: ([
				{ label: 'Permissive', value: 'permissive' },
				{ label: 'Weak copyleft', value: 'weak-copyleft' },
				{ label: 'Strong copyleft', value: 'strong-copyleft' },
			] as const).map((option) => ({
				...option,
				label: linkLicenseName(option.label, option.value),
			})),
		})

		if (clack.isCancel(category)) {
			process.exit(1)
		}

		options = licenseOptions.software[category]
	} else {
		options = licenseOptions[licenseType]
	}

	const selectedLicenseId = await selectLicenseTable({
		message: `Choose a ${licenseType.replaceAll('-', ' ')} license:`,
		options,
	})

	if (clack.isCancel(selectedLicenseId)) {
		process.exit(1)
	}

	const licenseData = spdxLicenseList[selectedLicenseId]
	if (!licenseData) {
		throw new Error(`License "${selectedLicenseId}" is not an SPDX license`)
	}

	const existingFiles = new Set(await fs.readdir('.'))
	const selectedFilename = await clack.select({
		message: 'Choose a license filename:',
		options: [
			'LICENSE',
			`LICENSE-${selectedLicenseId}`,
			'LICENSE.txt',
			`LICENSE-${selectedLicenseId}.txt`,
		].map((filename) => ({
			value: filename,
			label: existingFiles.has(filename) ? styleText('yellow', filename) : filename,
		})),
	})

	if (clack.isCancel(selectedFilename)) {
		process.exit(1)
	}

	await fs.writeFile(selectedFilename, licenseData.licenseText, 'utf-8')
}
