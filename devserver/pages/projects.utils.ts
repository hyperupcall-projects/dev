import untildify from 'untildify'

export const Ctx = {
	cloneDir: untildify('~/.dev/.data/cloned-repositories'),
	symlinkedRepositoriesDir: untildify('~/Documents/Repositories'),
	ignoredRepos: [
		// Skip cloning from the following organizations:
		'eshsrobotics/*',
		'hackclub/*',
		'replit-discord/*',
		'gamedevunite-at-smc/*',
		'cs-club-smc/*',
		'ecc-cs-club/*',
		'GameDevUniteAtECC/*',
		'EpicGames/*',
		'fox-archives/*',
		'fox-templates/*',
		'fox-forks/*',
		'asdf-contrib-hyperupcall/*',
		// Skip cloning from the following repositories:
		'hyperupcall/hidden',
		'hyperupcall/secrets',
		'hyperupcall/dotfiles',
		'fox-incubating/dev',
	],
}
