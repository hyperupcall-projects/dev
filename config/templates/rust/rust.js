import dedent from 'dedent'
import { writeTrees } from '../../common.js'
import { execa } from 'execa'
import { badValue } from '../../common.js'

/**
 * @typedef {import('../../new.js').Context} Context
 */

/**
 * @param {Context} ctx
 */
export async function run(ctx) {
	await execa('cargo', ['run'], {
		stdio: 'inherit',
	})
}
