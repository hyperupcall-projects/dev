import { execa } from 'execa'
import { writeTrees } from '../util/util.js'
import dedent from 'dedent'

/**
 * @typedef Options
 * @property {string} projectSlug
 * @property {string} projectVariant
 *
 * @param {Options} opts
 */
export async function initGo(opts) {
	if (opts.projectVariant === 'hello-world') {
		await initHelloWorld(opts)
	} else if (opts.projectVariant === 'cli') {
		await initCli(opts)
	} else if (opts.projectVariant === 'web-server') {
		await initWebServer(opts)
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
 * @param {Options} opts
 */
async function initHelloWorld(opts) {
	await goModInit(opts.projectSlug)
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
 * @param {Options} opts
 */
async function initCli(opts) {}

/**
 * @param {Options} opts
 */
async function initWebServer(opts) {}

/**
 * @param {Options} opts
 */
function boilerplateTree(opts) {
	return {
		'main.go': mainGo(opts),
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
