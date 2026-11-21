// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2023 Edwin Kofler
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { globby } from 'globby'
import shebangCommand from 'shebang-command'
import { ignoreDirectoriesGlob } from './util.ts'

const BASENAME_TO_ID: Record<string, string> = {
	'.clang-format': 'yaml',
	'.clang-tidy': 'yaml',
	'.clangd': 'yaml',
	'.dockerignore': 'ignorefile',
	'.editorconfig': 'editorconfig',
	'.env': 'dotenv',
	'.eslintignore': 'ignorefile',
	'.gitattributes': 'gitattributes',
	'.gitignore': 'ignorefile',
	'.gitkeep': 'empty',
	'.gitmodules': 'gitmodules',
	'.npmignore': 'ignorefile',
	'.prettierignore': 'ignorefile',
	cmakelists: 'cmake',
	'cmakelists.txt': 'cmake',
	containerfile: 'dockerfile',
	copying: 'plaintext',
	dockerfile: 'dockerfile',
	gemfile: 'ruby',
	gnumakefile: 'makefile',
	license: 'plaintext',
	makefile: 'makefile',
	notice: 'plaintext',
	rakefile: 'ruby',
}

const EXT_TO_ID: Record<string, string> = {
	// archive
	'7z': 'binary',
	boz: 'binary',
	bz2: 'binary',
	gz: 'binary',
	rar: 'binary',
	tar: 'binary',
	xz: 'binary',
	zip: 'binary',
	// binary
	wasm: 'binary',
	// c
	c: 'c',
	dic: 'c',
	h: 'c',
	// cmake
	cmake: 'cmake',
	// cpp
	cc: 'cpp',
	cpp: 'cpp',
	cxx: 'cpp',
	hh: 'cpp',
	hpp: 'cpp',
	hxx: 'cpp',
	// css
	css: 'css',
	// dotenv
	env: 'dotenv',
	// executable
	bat: 'binary',
	com: 'binary',
	dll: 'binary',
	exe: 'binary',
	msi: 'binary',
	// gif
	gif: 'gif',
	// go
	go: 'go',
	// html
	htm: 'html',
	html: 'html',
	shtml: 'html',
	// ico
	ico: 'binary',
	// ini
	cfg: 'ini',
	conf: 'ini',
	desktop: 'ini',
	ini: 'ini',
	service: 'ini',
	// java
	java: 'java',
	// javascript
	cjs: 'javascript',
	js: 'javascript',
	jsx: 'javascript',
	mjs: 'javascript',
	// jpeg
	jpe: 'binary',
	jpeg: 'binary',
	jpg: 'binary',
	// json
	json: 'json',
	map: 'json',
	// jsonc
	jsonc: 'jsonc',
	// latex
	cls: 'latex',
	ltx: 'latex',
	sty: 'latex',
	tex: 'latex',
	// markdown
	markdown: 'markdown',
	md: 'markdown',
	// pdf
	pdf: 'binary',
	// perl
	pl: 'perl',
	pm: 'perl',
	t: 'perl',
	// php
	php: 'php',
	// png
	png: 'binary',
	// plaintext
	def: 'plaintext',
	in: 'plaintext',
	list: 'plaintext',
	log: 'plaintext',
	text: 'plaintext',
	txt: 'plaintext',
	// python
	py: 'python',
	pyi: 'python',
	pyw: 'python',
	// ruby
	gemspec: 'ruby',
	rake: 'ruby',
	rb: 'ruby',
	ru: 'ruby',
	// rust
	rs: 'rust',
	// shell
	bash: 'shell',
	ksh: 'shell',
	sh: 'shell',
	zsh: 'shell',
	// svg
	svg: 'svg',
	svgz: 'svg',
	// toml
	toml: 'toml',
	// typescript
	cts: 'typescript',
	mts: 'typescript',
	ts: 'typescript',
	tsx: 'typescript',
	// webp
	webp: 'webp',
	// xml
	rng: 'xml',
	xsl: 'xml',
	xsd: 'xml',
	xml: 'xml',
	xslt: 'xml',
	// yaml
	yaml: 'yaml',
	yml: 'yaml',
	// zig
	zig: 'zig',
	zon: 'zig',
}

const REGEX_TO_ID: [RegExp, string][] = [
	[/^dockerfile\./u, 'dockerfile'],
	[/^makefile\./u, 'makefile'],
	[/^\.env\./u, 'dotenv'],
]

const SHEBANG_TO_ID: Record<string, string> = {
	bash: 'shell',
	bun: 'typescript',
	dash: 'shell',
	deno: 'typescript',
	ksh: 'shell',
	node: 'javascript',
	nodejs: 'javascript',
	perl: 'perl',
	php: 'php',
	python: 'python',
	ruby: 'ruby',
	sh: 'shell',
	zsh: 'shell',
}

export async function detectFiletypes({
	rootDir,
	followSymbolicLinks = true,
	gitignore = true,
}: {
	rootDir: string
	followSymbolicLinks?: boolean
	gitignore?: boolean
	ignore?: string[]
}): Promise<Record<string, string[]>> {
	const filepaths = await globby('**', {
		cwd: rootDir,
		absolute: true,
		dot: true,
		gitignore,
		followSymbolicLinks,
		ignore: ignoreDirectoriesGlob()
	})

	const detected: Record<string, string[]> = {}
	for (const filepath of filepaths) {
		const basename = path.basename(filepath).toLowerCase()

		let filetype =
			BASENAME_TO_ID[basename] ??
			EXT_TO_ID[path.extname(basename).slice(1)] ??
			REGEX_TO_ID.find(([pattern]) => pattern.test(basename))?.[1]
		if (!filetype) {
			const handle = await fs.open(filepath, 'r')
			const { buffer, bytesRead } = await handle
				.read(Buffer.alloc(8192), 0, 8192, 0)
				.finally(() => handle.close())
			const sample = buffer.subarray(0, bytesRead)

			if (sample.includes(0)) {
				filetype = 'binary'
			} else {
				const interpreter = shebangCommand(sample.toString('utf8'))
					?.split(' ')[0]
					?.replace(/[0-9.]+$/u, '')
				filetype = SHEBANG_TO_ID[interpreter ?? '']
			}
		}

		filetype ??= '_other'
		detected[filetype] ??= []
		detected[filetype].push(filepath)
	}

	return detected
}
