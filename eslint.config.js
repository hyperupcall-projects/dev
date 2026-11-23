import config from '@hyperupcall/scripts-nodejs/config-eslint.js'

export default [
	...config,
	{
		ignores: ['vendor/*'],
	},
]
