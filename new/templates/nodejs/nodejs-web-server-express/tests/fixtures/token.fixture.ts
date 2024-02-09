import moment from 'moment';
import config from '../../src/config/config.js';
import { tokenTypes } from '../../src/config/tokens.js';
import tokenService from '../../src/services/token.service.js';
import { userOne, admin } from './user.fixture.js';

const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
export const userOneAccessToken = tokenService.generateToken(userOne._id, accessTokenExpires, tokenTypes.ACCESS);
export const adminAccessToken = tokenService.generateToken(admin._id, accessTokenExpires, tokenTypes.ACCESS);
