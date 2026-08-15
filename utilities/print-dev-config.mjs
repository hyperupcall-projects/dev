#!/usr/bin/env node
/**
 * Print one resolved value from ~/.devhidden/configs/dev.config.js.
 * Usage: node utilities/print-dev-config.mjs <dotted.key>
 * Example: node utilities/print-dev-config.mjs paths.nodeBinary
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** @returns {string} */
function getConfigPath() {
	if (process.env.DEV_CONFIG) return path.resolve(process.env.DEV_CONFIG)
	return path.join(os.homedir(), '.devhidden', 'configs', 'dev.config.js')
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function untildify(value) {
	if (value === '~') return os.homedir()
	if (typeof value === 'string' && value.startsWith('~/')) {
		return path.join(os.homedir(), value.slice(2))
	}
	return value
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function expand(value) {
	if (typeof value === 'string') return untildify(value)
	if (Array.isArray(value)) return value.map(expand)
	if (value !== null && typeof value === 'object') {
		/** @type {Record<string, unknown>} */
		const out = {}
		for (const [k, v] of Object.entries(value)) out[k] = expand(v)
		return out
	}
	return value
}

/**
 * @param {unknown} obj
 * @param {string} dotted
 * @returns {unknown}
 */
function getByPath(obj, dotted) {
	const parts = dotted.split('.')
	let cur = obj
	for (const part of parts) {
		if (cur == null || typeof cur !== 'object' || !(part in cur)) {
			throw new Error(`Key not found: ${dotted}`)
		}
		cur = /** @type {Record<string, unknown>} */ (cur)[part]
	}
	return cur
}

const key = process.argv[2]
if (!key) {
	console.error(`Usage: ${path.basename(import.meta.filename)} <dotted.key>`)
	process.exit(2)
}

const configPath = getConfigPath()
if (!fs.existsSync(configPath) || fs.statSync(configPath).size === 0) {
	console.error(`Missing or empty private config: ${configPath}`)
	process.exit(1)
}

const stat = fs.statSync(configPath)
const mod = await import(`${pathToFileURL(configPath).href}?t=${stat.mtimeMs}`)
const raw = mod.default
if (raw === undefined) {
	console.error(`Private config must use ESM export default: ${configPath}`)
	process.exit(1)
}
const config = expand(raw)
const value = getByPath(config, key)

if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
	process.stdout.write(String(value))
} else {
	process.stdout.write(JSON.stringify(value))
}
