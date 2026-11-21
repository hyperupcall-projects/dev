import path from 'node:path'
import { pkgRoot } from './util.ts'

export const Fullname = 'Edwin Kofler'

export type Formatter = {
	filetypes: string[]
	run: string[]
}

export const Formatters: Record<string, Formatter> = {
	yamlfmt: {
		filetypes: ['yaml'],
		run: ['yamlfmt', '-conf', path.join(pkgRoot(), 'config/.yamlfmt.yaml')],
	},
	prettier: {
		filetypes: [
			'javascript',
			'typescript',
			'json',
			'jsonc',
			'css',
			'html',
			'markdown',
			'yaml',
		],
		run: ['prettier', '--write'],
	},
	rustfmt: {
		filetypes: ['rust'],
		run: ['rustfmt'],
	},
	biome: {
		filetypes: ['javascript', 'typescript', 'json', 'jsonc', 'css'],
		run: ['biome', 'format', '--write'],
	},
	dprint: {
		filetypes: ['javascript', 'typescript', 'json', 'jsonc', 'markdown', 'toml'],
		run: ['dprint', 'fmt'],
	},
	'clang-format': {
		filetypes: ['c', 'cpp'],
		run: ['clang-format', '-i'],
	},
	gofmt: {
		filetypes: ['go'],
		run: ['gofmt', '-w'],
	},
	zig: {
		filetypes: ['zig'],
		run: ['zig', 'fmt'],
	},
	shfmt: {
		filetypes: ['shell'],
		run: ['shfmt', '-w'],
	},
	taplo: {
		filetypes: ['toml'],
		run: ['taplo', 'fmt'],
	},
	perltidy: {
		filetypes: ['perl'],
		run: ['perltidy', '-b', '-bext=/'],
	},
	rubyfmt: {
		filetypes: ['ruby'],
		run: ['rubyfmt', '-i'],
	},
	latexindent: {
		filetypes: ['latex'],
		run: ['latexindent', '-w'],
	},
	'markdownlint-cli2': {
		filetypes: ['markdown'],
		run: ['markdownlint-cli2', '--fix'],
	},
	mdformat: {
		filetypes: ['markdown'],
		run: ['mdformat'],
	},
	gersemi: {
		filetypes: ['cmake'],
		run: ['gersemi', '--in-place'],
	},
	ruff: {
		filetypes: ['python'],
		run: ['ruff', 'format'],
	},
}

export type Linter = Formatter

export const Linters: Record<string, Linter> = {
	yamllint: {
		filetypes: ['yaml'],
		run: ['yamllint', '-c', path.join(pkgRoot(), 'config/.yamllint.yaml')],
	},
}
