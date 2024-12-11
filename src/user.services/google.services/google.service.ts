//** GOOGLE AUTH LIBRARY IMPORT */
import { OAuth2Client } from "google-auth-library";
import { GetTokenResponse } from "google-auth-library/build/src/auth/oauth2client";

//** GOOGLE PASSKEY AUTH
import { generateAuthenticationOptions, verifyAuthenticationResponse, 
        VerifyAuthenticationResponseOpts, generateRegistrationOptions, 
        GenerateRegistrationOptionsOpts, verifyRegistrationResponse, VerifiedRegistrationResponse, 
        VerifiedAuthenticationResponse} from "@simplewebauthn/server";

//** TYPE INTERFACE IMPORT
import { PasskeyUser, PlayerInfo, User } from "../user.service.interface";
import { RegistrationResponseJSON, WebAuthnCredential } from "../auth.services.ts/auth.interface";

//** CONFIG IMPORT
import { ANDROID_APP_HASH, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "../../config/constants";

//** CLIENT IMPORT
import keydb from "../../db/keydb.client";

//** SERVICE IMPORT
import AuthService from "../auth.services.ts/auth.service";
import { SuccessMessage } from "../../outputs/success.message";
import { getDriver } from "../../db/memgraph";
import { Driver } from "neo4j-driver";


class GoogleService {

    // Authenticates the user with Google using the provided token.
    public async googleAuth(token: string): Promise<PlayerInfo> {
        try{
            const oAuth2Client = new OAuth2Client( GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
            const { tokens } = await oAuth2Client.getToken(token) as GetTokenResponse

            const apiUrl: string = 'https://games.googleapis.com/games/v1/players/me';
            const response: Response = await fetch(apiUrl, {
            method: 'GET',
            headers: { Authorization: `Bearer ${tokens.access_token}` },
            });

            const playerInfo: PlayerInfo = await response.json() as PlayerInfo ;

            return playerInfo as PlayerInfo
        } catch(error: any){
            throw error
        }
    }
    
    // Validates the Google authentication token and retrieves player information
    public async googleValidate(token: string): Promise<PlayerInfo> {
        try{
            const oAuth2Client: OAuth2Client = new OAuth2Client( GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
            const { tokens } = await oAuth2Client.getToken(token) as GetTokenResponse

            const apiUrl: string = 'https://games.googleapis.com/games/v1/players/me';
            const response: Response = await fetch(apiUrl, {
            method: 'GET',
            headers: { Authorization: `Bearer ${tokens.access_token}` },
            });

            const playerInfo: PlayerInfo = await response.json() as PlayerInfo ;

            return playerInfo as PlayerInfo
        } catch(error: any){
            throw error
        }
    }


    public async googlePassKeyAuth(username: {username: string}) {
        try {

            // Generate authentication options with parameters specific to your app
            const options = await generateAuthenticationOptions({
                challenge: undefined,
                rpID: "beats.gmetarave.com",  // The domain without "https://"
                userVerification: "required",
                timeout: 1800000,
                allowCredentials: [],
            });



            // Store the expected challenge in keydb temporarily for later verification
            // In production, use a secure session store or database with TTL if needed
            keydb.SET(`passkey:challenge:${username}`, options.challenge)

        
            // Return options to be sent to the client
            return options;

        } catch (error: any) {
            console.log(error)
            throw new Error(`Error generating passkey auth options: ${error.message}`);
        }
    }


    // Method to handle the passkey authentication response
    public async googlePassKeyAuthVerify(authVerify: {username: string, responseToken: string}) {
        const authService: AuthService = new AuthService()
        try {

            console.log(authVerify)

            // Retrieve the challenge that was previously stored
            const expectedChallenge = await keydb.hGet(`passkey:challenge:${authVerify.username}`, 'challenge') as string;
            
            // Parse the response token (it should be the JSON object from the client)
            const response = JSON.parse(authVerify.responseToken);
    
            // Extract the credential id and signature from the response token
            const credentialID = response.id;
            const signature = response.response.signature;  // This will be used for verification

            
            // Retrieve the credential public key and counter for this user from your storage
            const passkeyUser = await authService.getPasskeyUserData(authVerify.username);
            const { counter, publicKey  } = passkeyUser
            

            // Create the WebAuthnCredential object
            const credential: WebAuthnCredential = {
                id: credentialID,  // Use the credential ID from the response
                publicKey,// Use the stored public key for this user
                counter// Use the counter value from your storage
                // transports: expectedTransports || ['usb', 'nfc'],  // Use transports or default to 'usb' and 'nfc'
            };
    
            // Define the verification options
            const verificationOptions: VerifyAuthenticationResponseOpts = {
                response,
                expectedChallenge,  // The challenge you stored earlier
                expectedOrigin: 'https://beats.gmetarave.com',  // Your registered RP origin (domain)
                expectedRPID: 'beats.gmetarave.com',  // The RP ID (domain)
                credential,  // The WebAuthnCredential object
                requireUserVerification: true, // Optionally enforce user verification
            };
    
            // Perform the verification
            const verificationResult: VerifiedAuthenticationResponse = await verifyAuthenticationResponse(verificationOptions);
            

            console.log("resultsss: ", verificationResult)
            // Check if the verification was successful
            if (verificationResult.verified) {
                console.log("Authentication successful!");
                // Proceed with post-authentication actions (e.g., logging in the user)
            } else {
                console.log("Authentication failed.");
                // Handle failure (e.g., reject login attempt)
            }
    
        } catch (error: any) {
            // Handle any errors during the process
            console.log("Error verifying authentication response:", error);
            throw error;  // Or handle the error appropriately (e.g., return error message)
        }
    }
    

    public async googleRegisterPassKey(username: { username: string }) {
        try {
            const registrationOptions: GenerateRegistrationOptionsOpts = {
                rpName: "beats.game", // The name of your application
                rpID: "beats.gmetarave.com", // Your domain (this should match the domain in the origin)
                userName: username.username, // The unique username of the user
    
                // Generate a unique user ID as a Uint8Array for secure registration; this might come from your database
                userID: new TextEncoder().encode("unique-user-id"), 
    
                // Generate a secure random challenge as a Uint8Array (typically generated server-side)
                challenge: new TextEncoder().encode("secure-challenge-string"), 
    
                // Display name to show in the authenticator UI
                userDisplayName: username.username, 
    
                // Timeout for the registration process (e.g., 30 seconds)
                timeout: 30000, 
    
                // Specify attestation type, for example, 'none' to skip attestation information
                attestationType: "none",
    
                // Optionally exclude credentials to prevent re-registration with existing credentials
                excludeCredentials: [
                    {
                        id: "base64url-existing-credential-id", // Ensure this ID is in Base64URL format
                        transports: ['usb', 'nfc'], // Define supported transport types (optional)
                    }
                ],


    
                // Authenticator selection criteria, setting platform authenticator as an example
                authenticatorSelection: {
                    authenticatorAttachment: "platform", // 'platform' for passkeys on device
                    requireResidentKey: true,
                    userVerification: "required", // Enforce user verification
                },
            };


    
            // Call the function to generate registration options
            const options = await generateRegistrationOptions(registrationOptions);
            // await keydb.HSET(`passkey:challenge:${username}`, { challenge: options.challenge });

            keydb.SET(`challenge:${username.username}`, options.challenge)

            return options;
        } catch (error: any) {
            console.error("Error in googleRegisterPassKey:", error);
            throw error;
        }
    }


    public async googleVerifyPassKeyRegistration(response: RegistrationResponseJSON, ipAddress: string): Promise<SuccessMessage> {
        console.log(response)

        const driver: Driver = getDriver()
        const authService: AuthService = new AuthService(driver)
        try {

            const { username, deviceId } = response
            // Retrieve the expected challenge that was stored during registration initiation
            const expectedChallenge: string = await this.getStoredChallenge(username);
    
            // Define the expected origin

    
            // Define the expected Relying Party ID (RP ID)
            const expectedRPID: string  = 'beats.gmetarave.com';
    
            // Define the supported algorithms (example: ES256)
            const supportedAlgorithmIDs: number[] = [-7]; // COSEAlgorithmIdentifier for ES256
            
            // Construct the verification options
            const verifyOptions = {
                response, // This is your WebAuthn response object
                expectedChallenge,
                expectedOrigin: ANDROID_APP_HASH,
                expectedRPID,
                expectedType: 'webauthn.create',
                requireUserPresence: true,
                requireUserVerification: true,
                supportedAlgorithmIDs,
            };
    
            // Perform the verification
            const result: VerifiedRegistrationResponse =  await verifyRegistrationResponse(verifyOptions);

            //@ts-ignore
            const { id, publicKey, counter } = result.registrationInfo?.credential

            const userData: PasskeyUser = { userName: username, deviceId, id, publicKey, counter }
            await authService.passkeyRegister(userData, ipAddress);


            console.log("real :",  result)
            return new SuccessMessage("Registration successful")
        } catch (error: any) {
            console.error('Error in googleVerifyPassKeyRegistration:', error);
            throw error;
        }
    }


    // Function to retrieve the challenge for a user
    private async getStoredChallenge(username: string): Promise<string> {
        try {
            // Retrieve the stored challenge data from KeyDB
            const data = await keydb.get(`challenge:${username}`) as string;
            if (!data) {
                throw new Error(`No challenge found for user: ${username}`);
            }
    
            return data;
        } catch (error) {
            console.error('Error retrieving stored challenge:', error);
            throw error;
        }
    }
}

export default GoogleService


// Helper function to convert a string to Base64URL
function toBase64Url(str: string): string {
    const base64 = Buffer.from(str, 'utf-8').toString('base64');  // Convert string to base64
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');  // Base64 to Base64URL
}
