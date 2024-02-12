import { execa } from 'execa'
import { writeTrees } from '../../../fix/util.js'
import dedent from 'dedent'
import { badValue, templateTemplate } from '../../util.js'

/**
 * @typedef {import('../../new.js').Context} Context
 */

/**
 * @param {Context} ctx
 */
export async function run(ctx) {
	await execa('c++', ['run', '.'], {
		stdio: 'inherit',
	})
}
