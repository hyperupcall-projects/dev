import { test } from 'node:test'

import { customMerge } from '../config/common.js'
import assert from 'node:assert'

test('custom merge works', () => {
	let result = {}
	customMerge(result, { a: 1 })
	assert.deepStrictEqual(result, { a: 1 })

	result = { a: 1 }
	customMerge(result, { a: 2 })
	assert.deepStrictEqual(result, { a: 2 })

	result = { a: { b: 1 } }
	customMerge(result, { a: { bb: 2 } })
	assert.deepStrictEqual(result, { a: { b: 1, bb: 2 } })

	result = { a: { b: 1 } }
	customMerge(result, { a: { b: { __delete: null } } })
	assert.deepStrictEqual(result, { a: {} })

	result = {
		name: 'Edwin',
		dependencies: {
			'@hyperupcall/null': '1.0.0'
		}
	}
	customMerge(result, {
		dependencies: {
			'@hyperupcall/null2': { __delete: null }
		}
	})
	assert.deepStrictEqual(result, {
		name: 'Edwin',
		dependencies: {
			'@hyperupcall/null': '1.0.0'
		}
	})
})
