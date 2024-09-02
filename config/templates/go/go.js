import { execa } from 'execa'
import { writeTrees } from '../../common.js'
import dedent from 'dedent'
import { badValue } from '../../common.js'

/**
 * @typedef {import('../../new.js').Context} Context
 */

/**
 * @param {Context} ctx
 */
export async function init(ctx) {
	await execa('go', ['mod', 'init', `github.com/${ctx.name}`], {
		stdio: 'inherit',
	})
}
