import dedent from 'dedent'
import { writeTrees } from '../../../fix/util.js'
import { execa } from 'execa'
import { badValue } from '../../util.js'

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
