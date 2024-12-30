import moment from 'moment'
import config from '../../source/config/config.js'
import { tokenTypes } from '../../source/config/tokens.js'
import tokenService from '../../source/services/token.service.js'
import { userOne, admin } from './user.fixture.js'

const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes')
export const userOneAccessToken = tokenService.generateToken(
	userOne._id,
	accessTokenExpires,
	tokenTypes.ACCESS,
)
export const adminAccessToken = tokenService.generateToken(
	admin._id,
	accessTokenExpires,
	tokenTypes.ACCESS,
)
