//** MEMGRAPH IMPORT
import { Driver, ManagedTransaction, QueryResult, RecordShape, Session } from "neo4j-driver";

//** RETHINK DB IMPORT
import rt from "rethinkdb";
import { getRethinkDB } from "../../db/rethink";

//** OUTPUT IMPORTS
import ValidationError from "../../outputs/validation.error";
import { SuccessMessage } from "../../outputs/success.message";

//** SERVICE IMPORT
import TokenService from "../../user.services/token.services/token.service";

//** TYPE INTERFACES
import { UpdateStatsFailed, ProfilePicture, StatPoints, SoulMetaData, CardCollection, PictureLikes, BufferData, MyNote } from "./profile.interface";
import { PlayerStats } from "../../user.services/user.service.interface";


//** IMPORT THIRDWEB
import { NFTCollection, ThirdwebSDK } from '@thirdweb-dev/sdk';
import { CHAIN, PRIVATE_KEY, SECRET_KEY, SOUL_ADDRESS } from "../../config/constants";
import { CardMetaData } from "../inventory.services/inventory.interface";

//** NANOID IMPORT
import { nanoid } from "nanoid/async";


class ProfileService {
  driver?: Driver;
  constructor(driver?: Driver) {
    this.driver = driver;
  }

  public async updateStats(statPoints: StatPoints, token: string): Promise<any | UpdateStatsFailed> {
    try {
        const tokenService: TokenService = new TokenService();
        const username: string | Error = await tokenService.verifyAccessToken(token);

        const session: Session | undefined = this.driver?.session();
        if (!session) throw new Error('Session is undefined');

        const result: QueryResult<RecordShape> | undefined = await session.executeRead(tx =>
            tx.run(`MATCH (u:User {username: $username}) RETURN u.playerStats`, { username })
        );

        if (!result?.records.length) throw new ValidationError(`User with username '${username}' not found.`, "");

        const userData = result?.records[0].get('u.playerStats');
        const playerStats: PlayerStats = JSON.parse(userData);

        const { level, playerExp, availStatPoints, rank } = playerStats;
        const { mainVocalist, rapper, leadDancer, leadVocalist, mainDancer, visual, leadRapper } = statPoints;
        const totalStatPointsAdded =
            mainVocalist + rapper + leadDancer + leadVocalist + mainDancer + visual + leadRapper;

        if (
            Object.values(statPoints).some(val => val < 0) ||
            totalStatPointsAdded > availStatPoints
        ) throw new ValidationError(`Invalid stat changes detected.`, "");

        const newAvailStatPoints = Math.max(0, availStatPoints - totalStatPointsAdded);
        const updatedStatPointsSaved = {
            mainVocalist,
            rapper,
            leadDancer,
            leadVocalist,
            mainDancer,
            visual,
            leadRapper,
        };

        const updatedPlayerStats: PlayerStats = { level, playerExp, availStatPoints: newAvailStatPoints, rank, statPointsSaved: updatedStatPointsSaved };
        await session.executeWrite(tx =>
            tx.run(`MATCH (u:User {username: $username}) SET u.playerStats = $newPlayerStats`, { username, updatedPlayerStats })
        );
        await session.close();

        return { success: true, message: 'Stats updated successfully.', updatedPlayerStats };
    } catch (error: any) {
        console.error("Error updating stats:", error);
        return { success: false, message: 'Error updating stats.' } as UpdateStatsFailed;
    }
    }

  public async uploadProfilePic(imageBuffer: BufferData, token: string): Promise<SuccessMessage> {
      try {
        const tokenService: TokenService = new TokenService();
        const userName: string | Error = await tokenService.verifyAccessToken(token);
    
        // Check the number of existing profile pictures for the user
        //@ts-ignore
        const existingProfilePicsCount: number = await this.getProfilePicsCount(userName);

        if (existingProfilePicsCount >= 5) {
          throw new ValidationError(`You already have 5 profile pictures.`, "");
        }
    
        const uploadedAt: number = Date.now();
        const fileFormat: string = 'png';
        const fileSize: number = 100;
        
        // Assuming imageBuffer is already an array of numbers
        const profilePicture: ProfilePicture = {
          profilePicture: imageBuffer.bufferData,
          //@ts-ignore
          userName,
          uploadedAt,
          fileFormat,
          fileSize,
          likes: []
        };
    
        const connection: rt.Connection = await getRethinkDB();
    
        // Save the profile picture to the database
        await rt.db('beats').table('profilePic').insert(profilePicture).run(connection);
    

        return new SuccessMessage("Profile picture upload successful");
      } catch (error: any) {
        console.error("Error updating profile picture:", error);
        throw error;
      }
    }

  public async likeProfilePicture(token: string, likedProfilePicture: { id: string}) {
      try {
        const tokenService: TokenService = new TokenService();
        const userName: string | Error = await tokenService.verifyAccessToken(token);

        const session: Session | undefined = this.driver?.session();
    
        const result: QueryResult<RecordShape> | undefined = await session?.executeRead(tx =>
          tx.run(`MATCH (u:User {username: $userName}) RETURN u`, { userName })
        );
    
        if (!result?.records.length) throw new ValidationError(`User with username '${userName}' not found.`, "");
    
        const timestamp: number = Date.now();
        const likeId: string = await nanoid();
        
        //@ts-ignore
        const likeData: PictureLikes = { userName, timestamp, likeId };
    
        const pictureId: string = likedProfilePicture.id || "";
    
        const connection: rt.Connection = await getRethinkDB();
        
        // Get the profile picture from the database
        const query: ProfilePicture = await rt.db('beats').table('profilePic').get(pictureId).run(connection) as ProfilePicture;
    
        if (!query) {
          return new ValidationError(`Profile picture with ID '${pictureId}' not found.`, "");
        }
    
        // Check if the user already liked the picture
        const alreadyLiked = query.likes.some(like => like.userName === userName);
    
        if (!alreadyLiked) {
          // Add the new like
          query.likes.push(likeData);
    
          // Update the profile picture in the database
          await rt.db('beats').table('profilePic').get(pictureId).update({ likes: query.likes }).run(connection);
        } else {
          return new ValidationError(`User '${userName}' has already liked this picture.`, "");
        }
    
        return new SuccessMessage("Profile picture liked successfully");
      } catch (error: any) {
        console.error("Error liking profile picture:", error);
        throw error;
      }
    }

  public async unlikeProfilePicture(token: string, likedProfilePicture: { id: string}) {
      try {
        const tokenService: TokenService = new TokenService();
        const userName: string | Error = await tokenService.verifyAccessToken(token);
    
        const session: Session | undefined = this.driver?.session();
    
        const result: QueryResult<RecordShape> | undefined = await session?.executeRead(tx =>
          tx.run(`MATCH (u:User {username: $userName}) RETURN u`, { userName })
        );
    
        if (!result?.records.length) throw new ValidationError(`User with username '${userName}' not found.`, "");
    
        const pictureId: string = likedProfilePicture.id || "";
    
        const connection: rt.Connection = await getRethinkDB();
        
        // Get the profile picture from the database
        const query: ProfilePicture = await rt.db('beats').table('profilePic').get(pictureId).run(connection) as ProfilePicture;
    
        if (!query) {
          return new ValidationError(`Profile picture with ID '${pictureId}' not found.`, "");
        }
    
        // Check if the user has already liked the picture
        const likeIndex = query.likes.findIndex(like => like.userName === userName);
    
        if (likeIndex !== -1) {
          // Remove the like
          query.likes.splice(likeIndex, 1);
    
          // Update the profile picture in the database
          await rt.db('beats').table('profilePic').get(pictureId).update({ likes: query.likes }).run(connection);
        } else {
          return new ValidationError(`User '${userName}' has not liked this picture.`, "");
        }
    
        return new SuccessMessage("Profile picture unliked successfully");
      } catch (error: any) {
        console.error("Error unliking profile picture:", error);
        throw error;
      }
    }
    
  public async getPlayerProfilePic(token: string, playerUsername: string): Promise<ProfilePicture[]> {
      try {
        const tokenService: TokenService = new TokenService();
        await tokenService.verifyAccessToken(token);

        const userName: string = playerUsername
    
        const connection: rt.Connection = await getRethinkDB();
        const cursor: rt.Cursor = await rt
          .db('beats')
          .table('profilePic')
          .filter({ userName })
          .orderBy(rt.desc('uploadedAt'))
          .limit(10)
          .run(connection);
    
        const profilePictures: ProfilePicture[] = await cursor.toArray();

        return profilePictures as ProfilePicture[];
      } catch (error: any) {
        console.error(`Error processing the image: ${error.message}`);
        throw error;
      }
    }

  public async getProfilePic(token: string): Promise<ProfilePicture[]> {
      try {
        const tokenService: TokenService = new TokenService();
        const userName: string | Error = await tokenService.verifyAccessToken(token);
    
        const connection: rt.Connection = await getRethinkDB();
        const cursor: rt.Cursor = await rt
          .db('beats')
          .table('profilePic')
          .filter({ userName })
          .orderBy(rt.desc('uploadedAt'))
          .limit(1)
          .run(connection);
    
        const profilePictures: ProfilePicture[] = await cursor.toArray();
        
        return profilePictures as ProfilePicture[];
      } catch (error: any) {
        console.error(`Error processing the image: ${error.message}`);
        throw error;
      }
    }
    
  public async getDisplayPic(token: string, userNames: (string | undefined)[]): Promise<ProfilePicture[]> {
    try {
      const tokenService: TokenService = new TokenService();
      await tokenService.verifyAccessToken(token);

      const connection: rt.Connection = await getRethinkDB();
      const cursor: rt.Cursor = await rt
        .db('beats')
        .table('profilePic')
        .filter(userNames)
        .orderBy(rt.desc('uploadedAt'))
        .limit(1)
        .run(connection);

      const profilePictures: ProfilePicture[] = await cursor.toArray();

      return profilePictures as ProfilePicture[]
    } catch (error: any) {
        console.error("Error getting profile pictures:", error);
        throw new ValidationError(`Error retrieving the profile pictures: ${error.message}.`, "");
    }
    }

  public async changeProfilePic(token: string, newProfilePicture: { id: string }): Promise<SuccessMessage> {
      try {
          const tokenService: TokenService = new TokenService();
          await tokenService.verifyAccessToken(token);
  
          const { id } = newProfilePicture;
          const connection: rt.Connection = await getRethinkDB();
          const latestProfilePic = await rt
              .db('beats')
              .table('profilePic')
              .get(id)
              .run(connection);
  
          if (!latestProfilePic) {
              throw new Error('No profile picture found for the user');
          }
  
          // Update the user's profile picture to the latest one
          const updateResult: rt.WriteResult = await rt
              .db('beats')
              .table('profilePic')
              .get(id)
              .update({ uploadedAt: Date.now() })
              .run(connection);
  
          if (updateResult && updateResult.replaced === 1) {
              return new SuccessMessage('Profile picture updated successfully');
          } else {
              throw new Error('Failed to update profile picture');
          }
      } catch (error: any) {
          console.error('Error updating profile picture:', error);
          throw error;
      }
    }

  private async getProfilePicsCount(userName: string): Promise<number> {
      const connection: rt.Connection = await getRethinkDB();
      try {
        // Count the number of profile pictures for the user using filter
        const countResult: number = await rt
          .db('beats')
          .table('profilePic')
          .filter({ userName })
          .count()
          .run(connection);
        
        return countResult;
      } catch (error: any) {
        console.error(error);
        throw error;
    }
    }
    
  public async createSoulPreferences(token: string, soulMetadata: SoulMetaData): Promise<SuccessMessage> {
      const session: Session | undefined = this.driver?.session();
      const tokenService: TokenService = new TokenService();
      const userName: string | Error = await tokenService.verifyAccessToken(token);
      try{

          const result: QueryResult | undefined = await session?.executeRead(tx =>
              tx.run(`
              MATCH (u:User {username: $userName})
              OPTIONAL MATCH (u)-[:SOUL]->(s:Soul) 
              RETURN s, u.smartWalletAddress as smartWalletAddress`, { userName })
          );
          await session?.close();

          let smartWalletAddress: string | undefined;

          if (result && result.records.length > 0) {
            smartWalletAddress = result.records[0].get('smartWalletAddress');
          }

          // If no Soul node is connected to the user, create a Soul node
          const soulExists = result?.records.some(record => record.get('s') !== null);

          if (!soulExists) {
            //@ts-ignore
            await this.createSoul(userName, smartWalletAddress, soulMetadata);
          }
          else {
            //@ts-ignore
            await this.saveSoul(userName, soulMetadata)
    
          };

        return new SuccessMessage("Preference saved successfully")
      } catch(error: any) {
        throw error
      }
    }

  private async createSoul(userName: string, walletAddress: string | undefined, soulMetadata: SoulMetaData) {
      const session: Session | undefined = this.driver?.session();

      try {
        const sdk: ThirdwebSDK = ThirdwebSDK.fromPrivateKey(PRIVATE_KEY, CHAIN, {
          secretKey: SECRET_KEY,
        });
    
        // Update metadata using ERC1155 contract
        const soul: NFTCollection = await sdk.getContract(SOUL_ADDRESS, "nft-collection");

        const lastUpdated: string = new Date().toISOString();

        const ownership: String[] = [];
        const horoscopeMatch: String[] = [];
        const animalMatch: String[] = []
        const likedGroups: String[] = [];
        const weeklyFirst: String [] = [];

        const metadata = {...soulMetadata, lastUpdated, ownership, horoscopeMatch, likedGroups, animalMatch, weeklyFirst}
        //@ts-ignore
        await soul.erc721.mintTo(walletAddress, metadata);

        const ownedSouls = await soul.getOwned(walletAddress);

        ///@ts-ignore
        const newSoulMetadata: SoulMetaData = ownedSouls[ownedSouls.length - 1].metadata;
        await session?.executeWrite(tx =>
          tx.run(
            `
            MATCH (u:User { username: $userName })
            CREATE (s:Soul)
            MERGE (u)-[:SOUL]->(s)
            SET s = $newSoulMetadata
            `,
            { userName, newSoulMetadata }
          )
        );

        await session?.close();
  
      } catch (error: any) {
        throw error;
    }
    }

  private async saveSoul(userName: string, soulMetadata: SoulMetaData): Promise<void> {
      const session: Session | undefined = this.driver?.session();
      try {
        const result: QueryResult | undefined = await session?.executeRead(tx =>
          tx.run(
            `
            MATCH (u:User {username: $userName})-[:SOUL]->(s:Soul) 
            RETURN s.id as id`,
            { userName }
          )
        );
    
        if (!result || result.records.length === 0) {
          throw new Error(`No tokenId found for user: ${userName}`);
        }
    
        const tokenId: string = result.records[0].get('id');
        
        await session?.close(); 
    
        const sdk: ThirdwebSDK = ThirdwebSDK.fromPrivateKey(PRIVATE_KEY, CHAIN, {
          secretKey: SECRET_KEY,
        });
        const lastUpdated: string = new Date().toISOString();
        const metadata = { ...soulMetadata, lastUpdated, };

        
        // Update metadata using ERC1155 contract
        const edition: NFTCollection = await sdk.getContract(SOUL_ADDRESS, "nft-collection");
        await edition.erc721.updateMetadata(tokenId, metadata);


        const sessionWrite: Session | undefined = this.driver?.session(); 
        await sessionWrite?.executeWrite(tx =>
          tx.run(
            `
            MATCH (u:User {username: $userName})-[:SOUL]->(s:Soul) 
            SET s += $metadata`,
            { userName, metadata }
          )
        );
    
        await sessionWrite?.close();
    
      } catch (error: any) {
        throw error;
      } finally {
        await session?.close();
    }
    
    }

  public async getSoul(token: string): Promise<SoulMetaData> {
      const tokenService: TokenService = new TokenService();
      try {
          // Verify the access token and get the username
          const userName: string | Error = await tokenService.verifyAccessToken(token);
          
          const session: Session | undefined = this.driver?.session();
          const result: QueryResult | undefined = await session?.executeRead(tx =>
              tx.run(`
                  MATCH (u:User { username: $userName })-[:SOUL]->(s:Soul)
                  RETURN s as soul
              `, { userName })
          );

          await session?.close();
  
          if (!result || result.records.length === 0) {
            //@ts-ignore
              return {}
          }
  
          const soul: SoulMetaData = result.records[0].get('soul').properties;
  
          const { ...filteredSoulNode } = soul;
  
          return filteredSoulNode as SoulMetaData;
      } catch (error: any) {
          throw error;
      } 
    }

  public async getOwnedCardCount(token: string): Promise<{ [groupName: string]: number }> {
      const tokenService: TokenService = new TokenService();
      try {
          // Verify the access token and get the username
          const userName: string | Error = await tokenService.verifyAccessToken(token);
          
          const session: Session | undefined = this.driver?.session();
          const result: QueryResult | undefined = await session?.executeRead(tx =>
              tx.run(`
                  MATCH (u:User { username: $userName })-[:INVENTORY|EQUIPPED]->(c:Card)
                  WITH c.group AS groupName, count(c) AS cardCount
                  RETURN groupName, cardCount
              `, { userName })
          );
          await session?.close();
  
          if (result) {
              const counts: { [groupName: string]: number } = {};
              result.records.forEach(record => {
                  const groupName = record.get('groupName');
                  const cardCount = record.get('cardCount').toNumber();
                  counts[groupName] = cardCount;
              });
              return counts;
          } else {
              throw new Error('Failed to retrieve card counts');
          }
      } catch (error: any) {
          throw error;
      }
    }

  public async getCardCollection(token: string): Promise<CardCollection[]> {
      try {
        const tokenService: TokenService = new TokenService();
        const userName: string | Error = await tokenService.verifyAccessToken(token);
    
        const session: Session | undefined = this.driver?.session();
    
        const getCardCollectionCypher = `
          MATCH (u:User {username: $userName})-[:EQUIPPED|INVENTORY|BAGGED]->(c:Card)
          WITH c.name AS cardName, collect(c) AS cards
          RETURN cardName, cards[0] AS card, size(cards) AS count
        `;
    
        const result: QueryResult<RecordShape> | undefined = await session?.executeRead(
          (tx: ManagedTransaction) =>
            tx.run(getCardCollectionCypher, { userName })
        );

        await session?.close();

        const cardCollection = result?.records.map(record => {
          const card: CardMetaData = record.get('card').properties;
          delete card.imageByte;
    
          return {
            name: record.get('cardName'),
            card: card,
            count: record.get('count').toInt()
          };
        });
    
        return cardCollection as CardCollection[]
    
      } catch (error: any) {
        throw error;
      }
    }

  public async updateMyNotes(token: string, myNotes: MyNote): Promise<SuccessMessage | Error> {
      try {
        const { note } = myNotes
        if (note.length > 60) {
          return new Error("Note exceeds the 60 character limit.");
        }
    
        const tokenService: TokenService = new TokenService();
        const userName: string | Error = await tokenService.verifyAccessToken(token);
    
        const connection: rt.Connection = await getRethinkDB();
        
        const timestamp: number = Date.now();
        const noteData = { userName, note, createdAt: timestamp, updatedAt: timestamp };
    
        // Insert the new note or update the existing one
        await rt.db('beats').table('myNotes').insert(noteData, { conflict: "replace" }).run(connection);

        return new SuccessMessage("My notes updated");
      } catch (error: any) {
        console.error("Error updating note:", error);
        throw error;
      }
    }

  public async getMutualMyNotes(token: string,): Promise<MyNote | {}> {
      try {
        const tokenService: TokenService = new TokenService();
        const userName: string | Error = await tokenService.verifyAccessToken(token);
    
        const connection: rt.Connection = await getRethinkDB();
        
        // Retrieve the latest note for the user
        const cursor: rt.Cursor = await rt
          .db('beats')
          .table('myNotes')
          .filter({ userName })
          .orderBy(rt.desc('createdAt')) // Order by createdAt timestamp in descending order
          .limit(1) // Limit to one result
          .run(connection);
        
        const notesArray: MyNote[] = await cursor.toArray();
        
        if (notesArray.length === 0) {
          return {}
        }
    
        const myNote: MyNote = notesArray[0];
    
        return myNote;
      } catch (error: any) {
        console.error("Error retrieving note:", error);
        throw error;
      }
    }

  public async getMyNotes(token: string,): Promise<MyNote | {}> {
      try {
        const tokenService: TokenService = new TokenService();
        const userName: string | Error = await tokenService.verifyAccessToken(token);
    
        const connection: rt.Connection = await getRethinkDB();
        
        // Retrieve the latest note for the user
        const cursor: rt.Cursor = await rt
          .db('beats')
          .table('myNotes')
          .filter({ userName })
          .orderBy(rt.desc('createdAt')) // Order by createdAt timestamp in descending order
          .limit(1) // Limit to one result
          .run(connection);
        
        const notesArray: MyNote[] = await cursor.toArray();
        
        if (notesArray.length === 0) {
          return {}
        }
    
        const myNote: MyNote = notesArray[0];
    
        return myNote;
      } catch (error: any) {
        console.error("Error retrieving note:", error);
        throw error;
      }
    }

  public async moments(token: string, myNotes: MyNote): Promise<SuccessMessage | Error> {
      try {
        const { note } = myNotes
        if (note.length > 60) {
          return new Error("Note exceeds the 60 character limit.");
        }
    
        const tokenService: TokenService = new TokenService();
        const userName: string | Error = await tokenService.verifyAccessToken(token);
    
        const connection: rt.Connection = await getRethinkDB();
        
        const timestamp: number = Date.now();
        const noteData = { userName, note, createdAt: timestamp, updatedAt: timestamp };
    
        // Insert the new note or update the existing one
        await rt.db('beats').table('myNotes').insert(noteData, { conflict: "replace" }).run(connection);

        return new SuccessMessage("My notes updated");
      } catch (error: any) {
        console.error("Error updating note:", error);
        throw error;
      }
    }



    

}
export default ProfileService