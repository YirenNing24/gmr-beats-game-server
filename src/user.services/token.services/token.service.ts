//** FAST JWT IMPORT
import { createSigner, createVerifier } from 'fast-jwt';

//** CONFIG IMPORT
import { JWT_SECRET, GAME_SERVER_KEY } from '../../config/constants';

//** TYPE INTERFACE IMPORT
import { TokenScheme } from '../user.service.interface';

const ACCESS_TOKEN_EXPIRY = '5m';
const REFRESH_TOKEN_EXPIRY = '30m';

class TokenService {

	public async refreshTokens(token: string): Promise<TokenScheme> {
		try {
			const tokens: TokenScheme = await this.verifyRefreshToken(token);
			return tokens as TokenScheme;
		} catch (error: any) {
			return error;
		}
	}

	public async generateTokens(username: string): Promise<TokenScheme> {
		try {
			const signSync = createSigner({ key: JWT_SECRET, expiresIn: REFRESH_TOKEN_EXPIRY });
			const refreshToken: string = signSync({ userName: username });

			const accessToken: string = await this.generateAccessToken(username);

			return { refreshToken, accessToken, userName: username } as TokenScheme;
		} catch (error: any) {
			console.log(error);
			return error;
		}
	}

	private async generateAccessToken(username: string): Promise<string> {
		try {
			const signSync = createSigner({ key: JWT_SECRET, expiresIn: ACCESS_TOKEN_EXPIRY });
			const accessToken: string = signSync({ userName: username });

			return accessToken as string;
		} catch (error: any) {
			console.log(error);
			return error
		}
	}

	public async verifyAccessToken(token: string): Promise<string> {
		try {
			const verifyAccessTokenSync = createVerifier({ key: JWT_SECRET });
			const decodedToken = verifyAccessTokenSync(token);

			const { userName } = decodedToken as { userName: string };

			return userName as string;
		} catch (error: any) {
		  console.log(error);
		  return error;
		}
	}

	public async verifyRefreshToken(token: string): Promise<TokenScheme> {
		try {
			const verifyAccessTokenSync: (token: string | Buffer) => any = createVerifier({ key: JWT_SECRET });
			const decodedToken = verifyAccessTokenSync(token);

			const { userName } = decodedToken as { userName: string };
			const tokens: TokenScheme = await this.generateTokens(userName);

			return tokens as TokenScheme;
		} catch (error: any) {
			return error;
		}
	}

	public async verifyApiKey(apiKey: string): Promise<boolean> {
		try {
			if (GAME_SERVER_KEY == apiKey) {
				return true;
			}
			else {
				return false
			}
		} catch(error: any) {
		  throw error;
		}
	}

}

export default TokenService;
