import * as fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import * as readline from 'node:readline/promises'
import { parseArgs } from 'node:util'

import { detectNewline, detectNewlineGraceful } from 'detect-newline'
import micromatch from 'micromatch'
import { globby, globbyStream } from 'globby'
import { execa } from 'execa'
import assert from 'node:assert'
import * as jsoncParser from 'jsonc-parser'
import untildify from 'untildify'
import yn from 'yn'
import walk from 'ignore-walk'
import { minimatch } from 'minimatch'

/**
 * @typedef FunctionOptions
 * @property {string} projectDir
 *
 * @param {FunctionOptions} options
 */
export async function run({ projectDir }) {
	async function onFile(/** @type {string} */ filepath) {
		const filename = path.basename(filepath)

		if (
			micromatch.isMatch(
				filename,
				[
					'*.{js{,x},{m,c}js,ts{,x},{m,c}ts,svelte,vue,java,kt,gradle,groovy,properties,rs,c,h,cc,cpp,hpp,go}',
				],
				{ dot: true, nocase: true },
			)
		) {
			// console.log('//')
			await insertAtTop(filepath)
		} else if (
			micromatch.isMatch(
				filename,
				[
					'*.{py,rb,sh,bash,bats,zsh,ksh,fish,elv,nu,ps1,yml,yaml,jsonc,jq,Containerfile,Dockerfile,service,desktop,conf,ini,mk,pl,inc,hcl}',
					'Vagrantfile',
					'meson.build',
					'Containerfile',
					'Dockerfile',
					'.*ignore',
					'.gitattributes',
					'.editorconfig',
					'.gemspec',
					'makefile',
				],
				{ dot: true, nocase: true },
			)
		) {
			// console.log('#')
		} else if (
			micromatch.isMatch(filename, ['*.{xml,html,md,toml,pro}'], {
				dot: true,
				nocase: true,
			})
		) {
			// console.log('<!-- -->')
		} else if (
			micromatch.isMatch(filename, '*.{css,scss,sass,less,styl}', {
				dot: true,
				nocase: true,
			})
		) {
			// console.log('/* */')
		} else if (
			micromatch.isMatch(filename, '*.{1,2,3,4,5,6,7,8,9,njk,m4,ml,hbs,rst}', {
				dot: true,
				nocase: true,
			})
			// .\"
		) {
		} else if (
			micromatch.isMatch(
				filename,
				[
					'*.{json,sublime-snippet,webmanifest,code-snippets,map,gradlew,webp,bat,jar,woff,woff2,png,jpg,jpeg,ttf,eot,svg,ico,gif,lock,zip,7z,gz,content,bin,asc,gpg,snap,txt,sum,work,test,log,emu,parsed,patch,diff,flattened,pdf,csv}',
					'*.a*',
					'*.so*',
					'*.env*',
					'*.txt',
					'*.test',
					'1.*',
					'CNAME',
					'go.mod',
					'*LICENSE*',
					'*COPYING*',
					'bake',
				],
				{ dot: true, nocase: true },
			) ||
			path.parse(filepath).ext === ''
		) {
			// skip
		} else {
			// console.log(`Not recognized: ${filepath}`)
		}
	}

	const repoDir = projectDir
	// Unfortunately, globby is too buggy when finding and using ignore files.
	// Instead, use 'ignore-walk', which does require a few hacks.
	const walker = new walk.Walker({
		path: repoDir,
		ignoreFiles: ['.gitignore', '.ignore', '__custom_ignore__'],
	})
	walker.ignoreRules['__custom_ignore__'] = ['.git'].map(
		(dirname) =>
			new minimatch.Minimatch(`**/${dirname}/*`, {
				dot: true,
				flipNegate: true,
			}),
	)
	walker.on('done', async (files) => {
		for (const file of files) {
			const filepath = path.join(repoDir, file)
			await onFile(filepath)
		}
	})
	walker.on('error', (err) => {
		if (err) {
			throw err
		}
	})
	walker.start()
}

/**
 * @param {string} filepath
 */
async function insertAtTop(filepath) {
	const content = await fs.readFile(filepath, 'utf-8')
	const lines = content.split('\n') || []

	const spdx = {
		licenseIdentifier: '',
		fileCopyrightText: '',
	}
	const postfixLines = []
	// TODO
	for (let i = 0; i < Math.min(lines.length, 20); ++i) {
		const line = lines[i]

		console.log('line', line)
		const match1 = line
			.trim()
			.match(/SPDX-License-Identifier: ((?:\p{Letter}|\d|[-_.]| )*)/u)
		if (match1) {
			spdx.licenseIdentifier = match1[1].trim()
		}

		const match2 = line
			.trim()
			.match(/SPDX-FileCopyrightText: ((?:\p{Letter}|\d|[-_.]| )*)/u)
		if (match2) {
			spdx.fileCopyrightText = match2[1].trim()
		}

		if (!line.includes('SPDX-')) {
			postfixLines.push(line)
		}
	}

	spdx.licenseIdentifier ||= 'MPL-2.0'
	spdx.fileCopyrightText ||= 'Copyright Edwin Kofler'

	const newLines = [
		commentWrap(
			path.basename(filepath),
			`SPDX-License-Identifier: ${spdx.licenseIdentifier}`,
		),
		commentWrap(
			path.basename(filepath),
			`SPDX-FileCopyrightText: ${spdx.fileCopyrightText}`,
		),
	].concat(postfixLines)
	await fs.writeFile(filepath, newLines.join(detectNewlineGraceful(content)))
}

/**
 * @param {string} filename
 * @param {string} line
 */
function commentWrap(filename, line) {
	const type = commentType(filename)

	if (type === 'double-slash') {
		return `// ${line}`
	} else if (type === 'octothorpe') {
		return `# ${line}`
	} else if (type === 'html-style') {
		return `<!-- ${line} -->`
	} else if (type === 'slash-asterisks') {
		return `/* ${line} */`
	}
}

/**
 * @typedef {'double-slash'|'octothorpe'|'html-style'|'slash-asterisks'|'unknown'|undefined} CommentTypes
 *
 * @param {string} filename
 * @returns {CommentTypes}
 */
function commentType(filename) {
	if (
		micromatch.isMatch(
			filename,
			[
				'*.{js{,x},{m,c}js,ts{,x},{m,c}ts,svelte,vue,java,kt,gradle,groovy,properties,rs,c,h,cc,cpp,hpp,go}',
			],
			{ dot: true, nocase: true },
		)
	) {
		return 'double-slash'
	}

	if (
		micromatch.isMatch(
			filename,
			[
				'*.{py,rb,sh,bash,bats,zsh,ksh,fish,elv,nu,ps1,yml,yaml,jsonc,jq,Containerfile,Dockerfile,service,desktop,conf,ini,mk,pl,inc,hcl}',
				'Vagrantfile',
				'meson.build',
				'Containerfile',
				'Dockerfile',
				'.*ignore',
				'.gitattributes',
				'.editorconfig',
				'.gemspec',
				'makefile',
			],
			{ dot: true, nocase: true },
		)
	) {
		return 'octothorpe'
	}

	if (
		micromatch.isMatch(filename, ['*.{xml,html,md,toml,pro}'], {
			dot: true,
			nocase: true,
		})
	) {
		return 'html-style'
	}

	if (
		micromatch.isMatch(filename, '*.{css,scss,sass,less,styl}', {
			dot: true,
			nocase: true,
		})
	) {
		return 'slash-asterisks'
	}

	if (
		micromatch.isMatch(filename, '*.{1,2,3,4,5,6,7,8,9,njk,m4,ml,hbs,rst}', {
			dot: true,
			nocase: true,
		})
	) {
		return 'unknown'
		// .\"
	}

	return undefined
	// if (
	// 	micromatch.isMatch(
	// 		filename,
	// 		[
	// 			'*.{json,sublime-snippet,webmanifest,code-snippets,map,gradlew,webp,bat,jar,woff,woff2,png,jpg,jpeg,ttf,eot,svg,ico,gif,lock,zip,7z,gz,content,bin,asc,gpg,snap,txt,sum,work,test,log,emu,parsed,patch,diff,flattened,pdf,csv}',
	// 			'*.a*',
	// 			'*.so*',
	// 			'*.env*',
	// 			'*.txt',
	// 			'*.test',
	// 			'1.*',
	// 			'CNAME',
	// 			'go.mod',
	// 			'*LICENSE*',
	// 			'*COPYING*',
	// 			'bake',
	// 		],
	// 		{ dot: true, nocase: true },
	// 	) ||
	// 	path.parse(filename).ext === ''
	// ) {
	// 	return undefined
	// }
}
