import * as fs from 'fs/promises'

/**
 * @param {string} filename
 * @returns {Promise<boolean>}
 */
export async function dependsOnFileExistence(filename) {
	return await fs
		.stat(filename)
		.then(() => true)
		.catch(() => false)
}
