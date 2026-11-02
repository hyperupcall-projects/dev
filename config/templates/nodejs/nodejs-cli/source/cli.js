import util from 'node:util'

const { positionals, values } = util.parseArgs({
	options: {
		version: {
			default: false,
			short: 'v',
			type: 'boolean',
		},
		help: {
			default: false,
			short: 'h',
			type: 'boolean',
		},
	},
})
