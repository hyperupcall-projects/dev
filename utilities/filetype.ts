// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2023 Edwin Kofler
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { globby } from 'globby'
import shebangCommand from 'shebang-command'

const FILENAME_TO_FILEID: Record<string, string> = {
	'.clang-format': 'clang-format',
	'.clang-tidy': 'clang-tidy',
	'.dockerignore': 'gitignore',
	'.editorconfig': 'editorconfig',
	'.env': 'dotenv',
	'.eslintignore': 'gitignore',
	'.gitattributes': 'gitattributes',
	'.gitignore': 'gitignore',
	'.gitkeep': 'empty',
	'.gitmodules': 'gitmodules',
	'.npmignore': 'gitignore',
	'.prettierignore': 'gitignore',
	cmakelists: 'cmake',
	'cmakelists.txt': 'cmake',
	containerfile: 'dockerfile',
	copying: 'license',
	dockerfile: 'dockerfile',
	gnumakefile: 'makefile',
	licence: 'license',
	license: 'license',
	makefile: 'makefile',
	notice: 'license',
}

const INTERPRETER_TO_FILEID: Record<string, string> = {
	bash: 'shell',
	bun: 'typescript',
	dash: 'shell',
	deno: 'typescript',
	ksh: 'shell',
	node: 'javascript',
	nodejs: 'javascript',
	php: 'php',
	python: 'python',
	sh: 'shell',
	zsh: 'shell',
}

const EXTENSION_TO_FILEID: Record<string, string> = {
	// archive
	'7z': 'archive',
	boz: 'archive',
	bz2: 'archive',
	gz: 'archive',
	rar: 'archive',
	tar: 'archive',
	xz: 'archive',
	zip: 'archive',
	// binary
	wasm: 'binary',
	// c
	c: 'c',
	dic: 'c',
	h: 'c',
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
	bat: 'executable',
	com: 'executable',
	dll: 'executable',
	exe: 'executable',
	msi: 'executable',
	// gif
	gif: 'gif',
	// go
	go: 'go',
	// html
	htm: 'html',
	html: 'html',
	shtml: 'html',
	// ico
	ico: 'ico',
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
	jpe: 'jpeg',
	jpeg: 'jpeg',
	jpg: 'jpeg',
	// json
	json: 'json',
	map: 'json',
	// jsonc
	jsonc: 'jsonc',
	// markdown
	markdown: 'markdown',
	md: 'markdown',
	// pdf
	pdf: 'pdf',
	// php
	php: 'php',
	// png
	png: 'png',
	// plaintext
	def: 'plaintext',
	in: 'plaintext',
	list: 'plaintext',
	log: 'plaintext',
	text: 'plaintext',
	txt: 'plaintext',
	// python
	py: 'python',
	pyw: 'python',
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
}

export type DetectFiletypesOptions = {
	rootDir: string
	/**
	 * Also follow symlinked files and directories. Defaults to `false`, which keeps
	 * symlinks out of the result (and out of `dev metalint`'s filetype list).
	 */
	followSymbolicLinks?: boolean
	/**
	 * Skip files that `.gitignore` files exclude. Defaults to `true`.
	 *
	 * Note that this also applies `.gitignore` files from parent directories, up to
	 * the enclosing git repository's root, so a gitignored directory can end up
	 * with no files at all.
	 */
	gitignore?: boolean
	/** Extra ignore patterns, on top of the ones always ignored. */
	ignore?: string[]
}

export async function detectFiletypes({
	rootDir,
	followSymbolicLinks = false,
	gitignore = true,
	ignore = [],
}: DetectFiletypesOptions): Promise<Record<string, string[]>> {
	const filepaths = await globby('**', {
		cwd: rootDir,
		absolute: true,
		dot: true,
		gitignore,
		followSymbolicLinks,
		ignore: ['**/.git/**', '**/target/**', ...ignore],
	})

	const detected: Record<string, string[]> = {}
	for (const filepath of filepaths) {
		const basename = path.basename(filepath).toLowerCase()
		const prefix = /^(dockerfile|makefile|\.env)\./u.exec(basename)?.[1]

		const handle = await fs.open(filepath, 'r')
		const { buffer, bytesRead } = await handle
			.read(Buffer.alloc(8192), 0, 8192, 0)
			.finally(() => handle.close())
		const sample = buffer.subarray(0, bytesRead)
		const interpreter = shebangCommand(sample.toString('utf8'))
			?.split(' ')[0]
			?.replace(/[0-9.]+$/u, '')

		const filetype =
			FILENAME_TO_FILEID[prefix ?? basename] ??
			INTERPRETER_TO_FILEID[interpreter ?? ''] ??
			EXTENSION_TO_FILEID[path.extname(basename).slice(1)] ??
			(sample.length === 0 ? 'empty' : '_other')

		detected[filetype] ??= []
		detected[filetype].push(filepath)
	}

	return detected
}
