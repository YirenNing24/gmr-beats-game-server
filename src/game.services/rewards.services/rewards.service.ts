//** MEMGRAPH DRIVER AND TYPES
import { Driver, ManagedTransaction, QueryResult, RecordShape, Session } from "neo4j-driver";

//** ERROR CODES
import ValidationError from '../../outputs/validation.error'

//** THIRDWEB IMPORTS
import { Edition, NFTCollection, ThirdwebSDK, Token } from "@thirdweb-dev/sdk";

//** CONFIGS
import { BEATS_TOKEN, CHAIN, PRIVATE_KEY, SECRET_KEY, SOCIAL_BADGES_ADDRESS, SOUL_ADDRESS } from "../../config/constants";

//** SERVICE IMPORTS
import TokenService from "../../user.services/token.services/token.service";
import { CardMetaData } from "../inventory.services/inventory.interface";
import { SoulMetaData } from "../profile.services/profile.interface";
import { SuccessMessage } from "../../outputs/success.message";

//** RETHINK DB IMPORT
import rt from "rethinkdb";
import { getRethinkDB } from "../../db/rethink";

//** TYPE INTERFACE IMPORT
import { AnimalMatch, CardOwned, RewardData } from "./reward.interface";






class RewardService {

    driver?: Driver;
    constructor(driver?: Driver) {
        this.driver = driver;
    }

    public async getAvailableCardReward(token: string) {
        const tokenService: TokenService = new TokenService();
        const userName: string = await tokenService.verifyAccessToken(token);

        let session: Session | undefined;

        try {
            session = this.driver?.session();

            const getCardRewardNodeCypher = `
                MATCH (u:User {username: $userName})-[:EQUIPPED|INVENTORY]->(c:Card)
                OPTIONAL MATCH (u)-[:SOUL]->(s:Soul)
                OPTIONAL MATCH (c)-[:REWARD]->(cr:CardReward)
                RETURN cr as CardReward, s as Soul, c as Card
            `;

            const result: QueryResult<RecordShape> | undefined = await session?.executeRead(
                (tx: ManagedTransaction) =>
                    tx.run(getCardRewardNodeCypher, { userName })
            );

            if (!result) {
                return [];
            }

            // Extract soul
            const soulNode = result.records.length > 0 ? result.records[0].get('Soul') : null;
            const soul: SoulMetaData = soulNode ? soulNode.properties : null;

            // Filter out cards whose names are in the soul's ownership array
            const cards = result.records.map(record => {
                const { name, id } = record.get('Card').properties;
                return { name, id } as { name: string, id: string };
            }).filter(card => !soul?.ownership?.includes(card.name));

            // Extract rewards
            const rewards = result.records.map(record => {
                const rewardNode = record.get('CardReward');
                return rewardNode ? rewardNode.properties : null;
            }).filter(reward => reward !== null);

            // Construct the final result
            const response = {
                cards,
                rewards,
                soul
            };
            //@ts-ignore
            return response;
        } catch (error: any) {
            console.error(error);
            throw error;
        } finally {
            if (session) {
                await session.close();
            }
        }
    }


    public async ClaimCardOwnershipReward(token: string, cardName: CardOwned) {
        const tokenService: TokenService = new TokenService();
        const userName: string = await tokenService.verifyAccessToken(token);

        let session: Session | undefined;

        try {
            const { name } = cardName;

            session = this.driver?.session();
            const getCardRewardNodeCypher = `
                MATCH (u:User {username: $userName})-[:EQUIPPED|INVENTORY]->(c:Card {name: $name})
                OPTIONAL MATCH (u)-[:SOUL]->(s:Soul)
                OPTIONAL MATCH (c)-[:REWARD]->(cr:CardReward)
                RETURN cr as CardReward, s as Soul, c as Card
            `;

            const result: QueryResult<RecordShape> | undefined = await session?.executeRead(
                (tx: ManagedTransaction) =>
                    tx.run(getCardRewardNodeCypher, { userName, name })
            );

            if (!result || result.records.length === 0) {
                throw new ValidationError("No matches found", "No matches found");
            }

            // Extract soul
            const soulNode = result?.records?.length > 0 ? result?.records[0].get('Soul') : null;
            const soul: SoulMetaData = soulNode ? soulNode.properties : null;

            // Check if the card name is in the soul's ownership array and call provideOwnershipReward
            if (!soul?.ownership?.includes(name)) {
                await this.provideOwnershipReward(userName, name); 
            }

            return new SuccessMessage("Rewards received")
        } catch (error: any) {
            console.error(error);
            throw error;
        } finally {
            if (session) {
                await session.close();
            }
        }
    }


    private async provideOwnershipReward(userName: string, cardName: string) {
        const session: Session | undefined = this.driver?.session();
        try {
            const getCardRewardNodeCypher = `
                MATCH (u:User {username: $userName})-[:EQUIPPED|INVENTORY]->(c:Card {name: $cardName})
                OPTIONAL MATCH (u)-[:SOUL]->(s:Soul)
                OPTIONAL MATCH (c)-[:REWARD]->(cr:CardReward)
                RETURN cr as CardReward, s as Soul, c as Card, u.smartWalletAddress as smartWalletAddress
            `;

            const result: QueryResult<RecordShape> | undefined = await session?.executeRead(
                (tx: ManagedTransaction) =>
                    tx.run(getCardRewardNodeCypher, { userName, cardName })
            );

            if (!result || result.records.length === 0) {
                throw new ValidationError("No matches found", "No matches found");
            }

            // Extract soul and smartWalletAddress
            const soulNode = result.records[0].get('Soul');
            if (!soulNode) {
                throw new ValidationError("No Soul node found", "No Soul node found");
            }

            const soul: SoulMetaData = soulNode.properties;
            const smartWalletAddress: string = result.records[0].get('smartWalletAddress');

            if (Array.isArray(soul.ownership)) {
                // Add the cardName to the ownership array
                const updatedOwnership: string[] = [...soul.ownership, cardName];

                // Update the Soul node with the new ownership array
                const updateOwnershipCypher = `
                    MATCH (u:User {username: $userName})-[:SOUL]->(s:Soul)
                    SET s.ownership = $updatedOwnership
                `;

                await session?.executeWrite(
                    (tx: ManagedTransaction) =>
                        tx.run(updateOwnershipCypher, { userName, updatedOwnership })
                );

                await this.sendRewardToken(smartWalletAddress, soul, updatedOwnership);
            } else {
                throw new ValidationError("Invalid ownership data", "Invalid ownership data");
            }

        } catch (error: any) {
            console.error(error);
            throw error;
        } finally {
            if (session) {
                await session.close();
            }
        }
    }


    private async sendRewardToken(smartWalletAddress: string, soulMetadata: SoulMetaData, ownership: string[]) {
        try {
            const sdk: ThirdwebSDK = ThirdwebSDK.fromPrivateKey(PRIVATE_KEY, CHAIN, {
                secretKey: SECRET_KEY,
            });

            const beats: Token = await sdk.getContract(BEATS_TOKEN, "token");
            await beats.erc20.transfer(smartWalletAddress, 100);

            const metadata = { ...soulMetadata, ownership };
            const edition: NFTCollection = await sdk.getContract(SOUL_ADDRESS, "nft-collection");

            //@ts-ignore
            await edition.erc721.updateMetadata(soulMetadata.id, metadata);

            const ownershipBadge = await sdk.getContract(SOCIAL_BADGES_ADDRESS, "edition");

            const tokenId: string = "0"
            const tokenAmount: string = "1"
            ownershipBadge.transfer(smartWalletAddress, tokenId, tokenAmount);

        } catch (error: any) {
            throw error;
        }
    }


    public async provideHoroscopeReward(token: string, cardName: CardOwned): Promise<SuccessMessage> {
        const tokenService: TokenService = new TokenService();
        const userName: string = await tokenService.verifyAccessToken(token);
    
        let session: Session | undefined;
    
        try {
            const { name } = cardName;
            session = this.driver?.session();
    
            const getCardRewardNodeCypher = `
                MATCH (u:User {username: $userName})-[:EQUIPPED|INVENTORY]->(c:Card {name: $name})
                OPTIONAL MATCH (u)-[:SOUL]->(s:Soul)
                RETURN s as Soul, c as Card
            `;
    
            const result: QueryResult<RecordShape> | undefined = await session?.executeRead(
                (tx: ManagedTransaction) =>
                    tx.run(getCardRewardNodeCypher, { userName, name })
            );
    
            if (!result || result.records.length === 0) {
                throw new ValidationError("No match found", "No match found");
            };
    
            // Extract soul
            const soulNode = result.records.length > 0 ? result.records[0].get('Soul') : null;
            const soul: SoulMetaData = soulNode ? soulNode.properties : null;
    
            const cards: CardMetaData[] = result.records.map(record => {
                const { zodiac, name } = record.get('Card').properties as CardMetaData;
                return { zodiac, name } as CardMetaData;
            });
    
            // Check for horoscope match and provide reward if necessary
            for (const card of cards) {
                if (soul?.horoscope === card.zodiac && (!soul.horoscopeMatch || !soul.horoscopeMatch.includes(card.name))) {
                    await this.provideHoroscopeRewardToUser(userName, card.name);
                    break;  // Exit loop after providing the reward for one matching card
                }
            }
            return new SuccessMessage("Horoscope reward received");
        } catch (error: any) {
            console.error(error);
            throw error
        } finally {
            if (session) {
                await session.close();
            }
        }
    }
    

    private async provideHoroscopeRewardToUser(userName: string, cardName: string) {
        const session: Session | undefined = this.driver?.session();
        try {
            const getHoroscopeRewardNodeCypher = `
                MATCH (u:User {username: $userName})-[:EQUIPPED|INVENTORY]->(c:Card {name: $cardName})
                OPTIONAL MATCH (u)-[:SOUL]->(s:Soul)
                OPTIONAL MATCH (c)-[:REWARD]->(cr:CardReward)
                RETURN cr as CardReward, s as Soul, c as Card, u.smartWalletAddress as smartWalletAddress
            `;
    
            const result: QueryResult<RecordShape> | undefined = await session?.executeRead(
                (tx: ManagedTransaction) =>
                    tx.run(getHoroscopeRewardNodeCypher, { userName, cardName })
            );
    
            if (!result || result.records.length === 0) {
                throw new ValidationError("No matches found", "No matches found");
            }
    
            // Extract soul and smartWalletAddress
            const soulNode = result.records[0].get('Soul');
            if (!soulNode) {
                throw new ValidationError("No Soul node found", "No Soul node found");
            }
    
            const soul: SoulMetaData = soulNode.properties;
            const smartWalletAddress: string = result.records[0].get('smartWalletAddress');
    
            if (Array.isArray(soul.horoscopeMatch)) {
                // Add the cardName to the horoscopeMatch array
                const updatedhoroscopeMatch: string[] = [...soul.horoscopeMatch, cardName];
    
                const updateHoroscopeCypher = `
                    MATCH (u:User {username: $userName})-[:SOUL]->(s:Soul)
                    SET s.horoscopeMatch = $updatedhoroscopeMatch
                `;
    
                await session?.executeWrite(
                    (tx: ManagedTransaction) =>
                        tx.run(updateHoroscopeCypher, { userName, updatedhoroscopeMatch })
                );
    
                await this.sendRewardHoroscope(smartWalletAddress, soul, updatedhoroscopeMatch);
            } else {
                throw new ValidationError("Invalid horoscopeMatch data", "Invalid horoscopeMatch data");
            }
        } catch (error: any) {
            console.error(error);
            throw error;
        } finally {
            if (session) {
                await session.close();
            }
        }
    }
    

    private async sendRewardHoroscope(smartWalletAddress: string, soulMetadata: SoulMetaData, updatedhoroscopeMatch: string[]) {
        try {
            const sdk: ThirdwebSDK = ThirdwebSDK.fromPrivateKey(PRIVATE_KEY, CHAIN, {
                secretKey: SECRET_KEY,
            });
    
            const beats: Token = await sdk.getContract(BEATS_TOKEN, "token");
            await beats.erc20.transfer(smartWalletAddress, 250);
    
            const metadata = { ...soulMetadata, horoscopeMatch: updatedhoroscopeMatch };
            const edition: NFTCollection = await sdk.getContract(SOUL_ADDRESS, "nft-collection");

            //@ts-ignore
            await edition.erc721.updateMetadata(soulMetadata.id, metadata);

            const zodiacMatchBadge: Edition = await sdk.getContract(SOCIAL_BADGES_ADDRESS, "edition");
            const tokenId: string = "1"
            const tokenAmount: string = "1"
            zodiacMatchBadge.transfer(smartWalletAddress, tokenId, tokenAmount);
    
        } catch (error: any) {
            throw error;
        }
    }


    public async provideAnimalReward(token: string, animalMatch: AnimalMatch) {
        const tokenService: TokenService = new TokenService();
        const userName: string = await tokenService.verifyAccessToken(token);

        let session: Session | undefined;
        try {

            const { name } = animalMatch;
            session = this.driver?.session();

            const getCardRewardNodeCypher = `
            MATCH (u:User {username: $userName})-[:EQUIPPED|INVENTORY]->(c:Card {name: $name})
            OPTIONAL MATCH (u)-[:SOUL]->(s:Soul)
            RETURN s as Soul, c as Card
        `;

        const result: QueryResult<RecordShape> | undefined = await session?.executeRead(
            (tx: ManagedTransaction) =>
                tx.run(getCardRewardNodeCypher, { userName, name })
        );

        if (!result || result.records.length === 0) {
            throw new ValidationError("No match found", "No match found");
        };

        // Extract soul
        const soulNode = result.records.length > 0 ? result.records[0].get('Soul') : null;
        const soul: SoulMetaData = soulNode ? soulNode.properties : null;

        const cards: CardMetaData[] = result.records.map(record => {
            const { animal, name } = record.get('Card').properties as CardMetaData;
            return { animal, name } as CardMetaData;
        });

        // Check for horoscope match and provide reward if necessary
        for (const card of cards) {
            if (soul?.animal1 || soul?.animal2 || soul?.animal3 === animalMatch.name && (!soul.animalMatch || !soul.animalMatch.includes(card.name))) {
                await this.provideAnimalRewardToUser(userName, card.name);
                break;  // Exit loop after providing the reward for one matching card
            }
        }

        return new SuccessMessage("Animal reward received");
        } catch(error: any) {
            throw error
        }
    }


    private async provideAnimalRewardToUser(userName: String, cardName: string) {
        const session: Session | undefined = this.driver?.session();
        try {

            try {
                const getAnimalRewardNodeCypher = `
                    MATCH (u:User {username: $userName})-[:EQUIPPED|INVENTORY]->(c:Card {name: $cardName})
                    OPTIONAL MATCH (u)-[:SOUL]->(s:Soul)
                    OPTIONAL MATCH (c)-[:REWARD]->(cr:CardReward)
                    RETURN cr as CardReward, s as Soul, c as Card, u.smartWalletAddress as smartWalletAddress
                `;
        
                const result: QueryResult<RecordShape> | undefined = await session?.executeRead(
                    (tx: ManagedTransaction) =>
                        tx.run(getAnimalRewardNodeCypher, { userName, cardName })
                );
        
                if (!result || result.records.length === 0) {
                    throw new ValidationError("No matches found", "No matches found");
                };
        
                // Extract soul and smartWalletAddress
                const soulNode = result.records[0].get('Soul');
                if (!soulNode) {
                    throw new ValidationError("No Soul node found", "No Soul node found");
                };
        
                const soul: SoulMetaData = soulNode.properties;
                const smartWalletAddress: string = result.records[0].get('smartWalletAddress');
        
                if (Array.isArray(soul.animalMatch)) {
                    // Add the cardName to the horoscopeMatch array
                    const updatedAnimalMatch: string[] = [...soul.animalMatch, cardName];

                    console.log(updatedAnimalMatch)
        
                    const updateAnimalCypher = `
                        MATCH (u:User {username: $userName})-[:SOUL]->(s:Soul)
                        SET s.animalMatch = $updatedAnimalMatch
                    `;
        
                    await session?.executeWrite(
                        (tx: ManagedTransaction) =>
                            tx.run(updateAnimalCypher, { userName, updatedAnimalMatch })
                    );
        
                    await this.sendRewardAnimal(smartWalletAddress, soul, updatedAnimalMatch);
                } else {
                    throw new ValidationError("Invalid animal data", "Invalid animal data");
                };


            } catch (error: any) {
                throw error;
            } finally {
                if (session) {
                    await session.close();
                }
            }

        } catch(error: any) {
            throw error
        }
    }


    private async sendRewardAnimal(smartWalletAddress: string, soulMetadata: SoulMetaData, updatedAnimalMatch: string []) {
        try {
            const sdk: ThirdwebSDK = ThirdwebSDK.fromPrivateKey(PRIVATE_KEY, CHAIN, {
                secretKey: SECRET_KEY,
            });
    
            const beats: Token = await sdk.getContract(BEATS_TOKEN, "token");
            await beats.erc20.transfer(smartWalletAddress, 350);
    
            const metadata = { ...soulMetadata, horoscopeMatch: updatedAnimalMatch };
            const edition: NFTCollection = await sdk.getContract(SOUL_ADDRESS, "nft-collection");

            //@ts-ignore
            await edition.erc721.updateMetadata(soulMetadata.id, metadata);
            const critterBuddiesBadge: Edition = await sdk.getContract(SOCIAL_BADGES_ADDRESS, "edition");

            const tokenId: string = "2"
            const tokenAmount: string = "1"
            critterBuddiesBadge.transfer(smartWalletAddress, tokenId, tokenAmount);

        } catch(error: any) {
            throw error
        }
    }


    public async firstScorer(userName: string, songName: string, smartWalletAddress: string, artist: string) {
        try {
            const sdk: ThirdwebSDK = ThirdwebSDK.fromPrivateKey(PRIVATE_KEY, CHAIN, {
                secretKey: SECRET_KEY,
            });
            
            const critterBuddiesBadge: Edition = await sdk.getContract(SOCIAL_BADGES_ADDRESS, "edition");
    
            // Set tokenId based on the artist
            let tokenId: string;
            switch (artist) {
                case 'ICU':
                    tokenId = "3";
                    break;
                case 'X:IN':
                    tokenId = "4";
                    break;
                case 'Great Guys':
                    tokenId = "5";
                    break;
                default:
                    tokenId = "";
                    break;
            }
    
            const tokenAmount: string = "1";
           
            const session: Session | undefined = this.driver?.session();
            await session?.executeWrite((tx: ManagedTransaction) =>
                tx.run(`
                    MATCH (u:User {username: $userName})-[:SOUL]->(s:Soul)
                    SET s.weeklyFirst = s.weeklyFirst + [$songName]
                `, { songName, userName })
            );
            await session?.close();

            await critterBuddiesBadge.transfer(smartWalletAddress, tokenId, tokenAmount);
    
        } catch (error: any) {
            throw error;
        }
    }


    public async getMissionRewardList(token: string): Promise<RewardData[]> {
        try {
            const tokenService: TokenService = new TokenService();
            const username: string = await tokenService.verifyAccessToken(token);

            const connection: rt.Connection = await getRethinkDB();
            const result = await rt.db('beats')
                .table('missions')
                .filter({ username })
                .run(connection);

            const availableMissionReward = result.toArray() as unknown as RewardData[]


            return availableMissionReward
        } catch(error: any) {
          throw error
        }
    }


    public async setMissionReward(username: string, rewardData: RewardData): Promise<void> {
        try {
            if (rewardData.type ==='song') {
                await this.setSongReward(username, rewardData);
            }

        } catch(error: any) {
          throw error
        }
    }


    private async setSongReward(username: string, rewardData: RewardData): Promise<void> {
        try {
            // Ensure that dataReward is always initialized
            let dataReward: RewardData | null = null;
    
            // Check if the song reward type is 'first'
            if (rewardData.songRewardType === "first") {
                dataReward = {
                    username,
                    type: rewardData.type,
    
                    songName: rewardData.songName,
                    songRewardType: rewardData.songRewardType,
    
                    reward: '1000',
                    rewardName: 'First time completing ' + rewardData.songName,
    
                    claimed: false,
                    eligible: true,
                };
            }
    
            // Proceed only if dataReward was initialized
            if (dataReward) {
                const connection: rt.Connection = await getRethinkDB();
                const result = await rt.db('beats')
                    .table('missions')
                    .insert(dataReward)
                    .run(connection);
    
                // Optionally, handle the result of the insertion here
                console.log('Reward inserted:', result);
            } else {
                // Optionally, handle cases where no reward data was set
                console.warn('No reward data to insert.');
            }
    
        } catch (error: any) {
            // Log the error and rethrow it for further handling
            console.error('Error setting song reward:', error);
            throw error;
        }
    }
    

    public async checkSongReward(username: string, rewardData: RewardData): Promise<boolean> {
        try {
            const { songName, songRewardType } = rewardData;
    
            // Get the RethinkDB connection
            const connection: rt.Connection = await getRethinkDB();
    
            // Query the 'missions' table with the specified filters
            const result = await rt.db('beats')
                .table('missions')
                .filter({ username, songName, songRewardType })
                .run(connection);
    
            // Process the result, if any data is returned, return true, otherwise false
            const data: RewardData[] = await result.toArray(); // Convert cursor to an array
    
            return data.length > 0; // Return true if data exists, otherwise false
    
        } catch (error: any) {
            // Log and throw the error for further handling
            console.error('Error checking song reward:', error);
            throw error;
        }
    }


    public async claimMissionReward(token: string, rewardData: RewardData) {
        try {
            const tokenService: TokenService = new TokenService();
            const username: string = await tokenService.verifyAccessToken(token);

            const connection: rt.Connection = await getRethinkDB();
            const result = await rt.db('beats')
                .table('missions')
                .filter({ username, ...rewardData })
                .run(connection);

            const missionReward: RewardData[] = await result.toArray() as unknown as RewardData[];

            console.log(missionReward)

            if (!missionReward[0].claimed) {
                await this.sendMissionReward(missionReward[0])
            }

          return new SuccessMessage('Mission reward successfully claimed')
        } catch(error: any) {
          throw error
        }
    }


    private async sendMissionReward(reward: RewardData) {
        const session: Session | undefined = this.driver?.session();
    
        try {
            const sdk: ThirdwebSDK = ThirdwebSDK.fromPrivateKey(PRIVATE_KEY, CHAIN, {
                secretKey: SECRET_KEY,
            });
    
            const { username } = reward;

            const result: QueryResult | undefined = await session?.executeRead(tx =>
                tx.run(`MATCH (u:User {username: $username}) RETURN u.smartWalletAddress AS smartWalletAddress`, { username })
            );
    
            const smartWalletAddress = result?.records[0]?.get("smartWalletAddress");
    
            if (!smartWalletAddress) {
                throw new Error(`No smart wallet address found for user: ${username}`);
            }
    
            // Interact with the ERC1155 contract using the Thirdweb SDK to transfer rewards
            const beatsToken: Token = await sdk.getContract(BEATS_TOKEN, "token");

            //@ts-ignore
            await beatsToken.transfer(smartWalletAddress, reward.reward);
            this.updateMissionRewardData(reward);

        } catch (error: any) {
            console.error(`Error sending mission reward: ${error.message}`);
            throw error;
        } finally {
            // Close the session after the transaction completes
            await session?.close();
        }
    }


    private async updateMissionRewardData(rewardData: RewardData) {
        try {
            const { username, songName, reward } = rewardData;
    
            const connection: rt.Connection = await getRethinkDB();
    
            await rt.db('beats')
                .table('missions')
                .filter({ username, songName, reward })
                .update({
                    claimed: true,
                    claimedAt: rt.now()
                })
                .run(connection);
    
        } catch (error: any) {
            console.error(`Error updating mission reward data: ${error.message}`);
            throw error;
        }
    }




    






    
    
}

export default RewardService;


