import untildify from 'untildify'

type RepositoryGroup = {
	name: string
	repositories: string[]
}

const RepositoryConfig = {
	// The following directories are associated with repositories. They either
	// contain cloned repositories or Git worktrees to cloned repositories.
	cloneDir: untildify('~/.dev/.data/managed-repositories'),
	repositoriesDir: untildify('~/Documents/Repositories'),
	machineRepositoriesDir: untildify('~/.dev/.data/machine-repositories'),
	repositoryGroups: [
		{
			name: 'bpkg',
			repositories: ['bpkg/*'],
		},
		// {
		// 	name: 'Foxium Browser',
		// 	repositories: ['foxium-browser/*'],
		// },
		{
			name: 'hacks.guide',
			repositories: ['hacks-guide/*'],
		},
		{
			name: 'Bash Bastion',
			repoitories: ['bash-bastion/*'],
		},
		{
			name: 'SchemaStore',
			repositories: ['SchemaStore/*', '!SchemaStore/json-validator'],
		},
	],
	ignored: [
		// Skip cloning from the following organizations:
		'eshsrobotics/*',
		'hackclub/*',
		// 'bpkg/*',
		'replit-discord/*',
		'gamedevunite-at-smc/*',
		// 'foxium-browser/*',
		'cs-club-smc/*',
		'ecc-cs-club/*',
		'quasipanacea/*',
		'semantic-hotkeys/*',
		'fox-archives/*',
		'fox-templates/*',
		'fox-forks/*',
		'asdf-contrib-hyperupcall/*',
		'fix-js/*',
		'big-blocks/*',
		'GameDevUniteAtECC/*',
		'swallowjs/*',
		'EpicGames/*',
		// Skip cloning from the following repositories:
		'SchemaStore/json-validator',
		'hyperupcall/hidden',
		'hyperupcall/secrets',
	],
}

export function setupRepositoryGroup(repositoryGroup: RepositoryGroup) {}
