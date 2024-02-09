import { execa } from 'execa'
import { writeTrees } from '../../fix/util/util.js'
import dedent from 'dedent'
import { badValue } from '../util.js'

/**
 * @typedef {import('../new.js').Vars} Vars
 *
 * @param {Vars} vars
 */
export async function initGo(vars) {
	if (vars.variant === 'hello-world') {
		await initHelloWorld(vars)
	} else if (vars.variant === 'cli') {
		await initCli(vars)
	} else if (vars.variant === 'web-server') {
		await initWebServer(vars)
	} else {
		badValue('variant', vars.variant)
	}
}

export async function runGo() {
	await execa('go', ['run', '.'], {
		stdin: 'inherit',
		stdout: 'inherit',
		stderr: 'inherit',
	})
}

/**
 * @param {Vars} vars
 */
async function initHelloWorld(vars) {
	await goModInit(vars.name)
	await writeTrees([
		{
			'main.go': dedent`
				package main

				import "fmt"

				func main() {
					fmt.Println("Hello, world!")
				}
				`,
		},
	])
}

/**
 * @param {Vars} vars
 */
async function initCli(vars) {}

/**
 * @param {Vars} vars
 */
async function initWebServer(vars) {}

/**
 * @param {Vars} vars
 */
function boilerplateTree(vars) {
	return {
		'main.go': mainGo(vars),
		'rustfmt.toml': rustFmtToml(),
		rustToolchainToml: rustToolchainToml(),
		'.editorconfig': editorConfig(),
	}
}

/**
 * @param {string} slug
 */
async function goModInit(slug) {
	await execa('go', ['mod', 'init', `github.com/${slug}`], {
		stdin: 'inherit',
		stdout: 'inherit',
		stderr: 'inherit',
	})
}
