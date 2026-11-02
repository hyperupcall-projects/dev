// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2023 Edwin Kofler
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileTypeFromFile } from 'file-type'
import { globby } from 'globby'
import mimeTypes from 'mime-types'
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
	bakefile: 'makefile',
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
	bash: 'shell',
	cc: 'cpp',
	cfg: 'ini',
	conf: 'ini',
	cpp: 'cpp',
	cts: 'typescript',
	cxx: 'cpp',
	desktop: 'ini',
	env: 'dotenv',
	go: 'go',
	hh: 'cpp',
	hpp: 'cpp',
	hxx: 'cpp',
	ini: 'ini',
	jsonc: 'jsonc',
	ksh: 'shell',
	mts: 'typescript',
	py: 'python',
	pyw: 'python',
	rs: 'rust',
	service: 'ini',
	ts: 'typescript',
	tsx: 'typescript',
	zsh: 'shell',
}

const MIME_TO_FILEID: Record<string, string> = {
	'application/gzip': 'archive',
	'application/json': 'json',
	'application/node': 'javascript',
	'application/pdf': 'pdf',
	'application/toml': 'toml',
	'application/wasm': 'binary',
	'application/x-7z-compressed': 'archive',
	'application/x-bzip2': 'archive',
	'application/x-elf': 'executable',
	'application/x-httpd-php': 'php',
	'application/x-mach-binary': 'executable',
	'application/x-msdownload': 'executable',
	'application/x-rar-compressed': 'archive',
	'application/x-sh': 'shell',
	'application/x-tar': 'archive',
	'application/x-xz': 'archive',
	'application/xml': 'xml',
	'application/xslt+xml': 'xml',
	'application/zip': 'archive',
	'application/zstd': 'archive',
	'image/gif': 'gif',
	'image/jpeg': 'jpeg',
	'image/png': 'png',
	'image/svg+xml': 'svg',
	'image/vnd.microsoft.icon': 'ico',
	'image/webp': 'webp',
	'text/css': 'css',
	'text/html': 'html',
	'text/javascript': 'javascript',
	'text/jsx': 'javascript',
	'text/markdown': 'markdown',
	'text/plain': 'plaintext',
	'text/x-c': 'c',
	'text/x-java-source': 'java',
	'text/yaml': 'yaml',
}

export async function detectFiletypes({
	rootDir,
}: {
	rootDir: string
}): Promise<string[]> {
	const filepaths = await globby('**', {
		cwd: rootDir,
		absolute: true,
		dot: true,
		gitignore: true,
		followSymbolicLinks: false,
		ignore: ['**/.git/**'],
	})

	const detected = new Set<string>()
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

		detected.add(
			FILENAME_TO_FILEID[prefix ?? basename] ??
				INTERPRETER_TO_FILEID[interpreter ?? ''] ??
				EXTENSION_TO_FILEID[path.extname(basename).slice(1)] ??
				MIME_TO_FILEID[mimeTypes.lookup(basename) || ''] ??
				MIME_TO_FILEID[(await fileTypeFromFile(filepath))?.mime ?? ''] ??
				(sample.length === 0 ? 'empty' : sample.includes(0) ? 'binary' : 'plaintext'),
		)
	}

	return [...detected].sort()
}
