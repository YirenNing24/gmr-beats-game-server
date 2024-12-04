//** MEMGRAPH DRIVER AND TYPES
import { Driver, ManagedTransaction, QueryResult, Session } from "neo4j-driver";

//** RETHINK DB
import rt from "rethinkdb";
import { getRethinkDB } from "../db/rethink";

//**THIRDWEB IMPORT
import { Edition, ThirdwebSDK } from "@thirdweb-dev/sdk";
import { SmartWallet } from "@thirdweb-dev/wallets";
import { LocalWalletNode } from "@thirdweb-dev/wallets/evm/wallets/local-wallet-node";

//** ERROR CODES
import ValidationError from "../outputs/validation.error";

//** TYPE INTERFACE IMPORTS
import { FollowResponse, ViewProfileData, ViewedUserData, 
         MutualData, PlayerStatus, SetPlayerStatus, 
         CardGiftData, CardGiftSending, PostFanMoment, 
         FanMomentId, FanMomentComment, PostComment } from "./social.services.interface";

import { MyNote, ProfilePicture } from "../game.services/profile.services/profile.interface";
import { SuccessMessage } from "../outputs/success.message";
import { NotificationData } from "../game.services/notification.services/notification.interface";

//** IMPORTED SERVICES 
import TokenService from "../user.services/token.services/token.service";
import ProfileService from "../game.services/profile.services/profile.service";
import NotificationService from "../game.services/notification.services/notification.service";

//** CONFIG IMPORT
import { CHAIN, EDITION_ADDRESS, SECRET_KEY, SMART_WALLET_CONFIG } from "../config/constants";

//**NANOID IMPORT
import { nanoid } from "nanoid/async";
import { followCypher, getFollowersFollowingCountCypher } from "./social.cypher";



class SocialService {

  private driver:Driver
  constructor(driver: Driver) {

  this.driver = driver;
  }

  public async follow(toFollow: { toFollow: string }, token: string): Promise<FollowResponse> {
    try {
      const tokenService: TokenService = new TokenService();
      const userName: string = await tokenService.verifyAccessToken(token);

      const userToFollow: string = toFollow.toFollow;
      const session: Session = this.driver.session();
      const result: QueryResult = await session.executeWrite((tx: ManagedTransaction) =>
        tx.run(followCypher,
          { userName, userToFollow }
        )
      );
      await session.close();

      if (result.records.length === 0) {
        throw new Error(`User to follow not found`);
      } else {
        const id: string = await nanoid();

        const notificationService: NotificationService = new NotificationService();

        // Properly creating a new Date object for notification
        const notification: NotificationData = {
          id,
          recipient: userToFollow,
          sender: userName,
          read: false,
          type: "followed",
          date: new Date(),
        };

        notificationService.createNotification(notification);
        return { status: "Followed" } as FollowResponse;
      }
    } catch (error: any) {
      console.error("Something went wrong: ", error);
      throw error;
    }
  }


  //** Unfollows a user.
  public async unfollow(toUnfollow: { toUnfollow: string }, token: string): Promise<FollowResponse> {
    try {

      const tokenService: TokenService = new TokenService();
      const userName: string = await tokenService.verifyAccessToken(token);

      const userToUnfollow: string = toUnfollow.toUnfollow
      const session = this.driver.session();
      const result: QueryResult = await session.executeWrite((tx: ManagedTransaction) =>
        tx.run( 
          `
          MATCH (u:User {username: $userName})-[r:FOLLOW]->(p:User {username: $userToUnfollow})
          DELETE r
          RETURN p {.*, 
            followed: false
          } AS unfollow
          `,
          { userName, userToUnfollow }
        ));
      await session.close();

      if (result.records.length === 0) {
        throw new Error("User to unfollow not found");
      } else {
        return { status: "Unfollowed"} as FollowResponse;
      }
    } catch (error: any) {
      console.error("Something went wrong: ", error);
      throw error;
    }
  }


  //** Retrieves profile information for a user's view of another user's profile.
  public async viewProfile(viewUsername: string, token: string): Promise<ViewProfileData> {
    const tokenService: TokenService = new TokenService();
    const userName: string = await tokenService.verifyAccessToken(token);
  
    const session: Session = this.driver.session();
    try {
      const result = await session.executeRead(async (tx: ManagedTransaction) => {
        const [userQuery, followQuery, followedByQuery, soul] = await Promise.all([
          tx.run('MATCH (u:User {username: $viewUsername}) RETURN u', { viewUsername }),
          tx.run(`
            MATCH (u:User {username: $userName})-[:FOLLOW]->(v:User {username: $viewUsername})
            OPTIONAL MATCH (u)-[:SOUL]->(s:Soul)
            RETURN COUNT(v) > 0 AS followsUser, s as Soul`,
            { userName, viewUsername }
          ),
          tx.run(`
            MATCH (v:User {username: $viewUsername})-[:FOLLOW]->(u:User {username: $userName})
            RETURN COUNT(u) > 0 AS followedByUser`,
            { userName, viewUsername }
          ),
          tx.run(`
          MATCH (u:User {username: $viewUsername})-[:SOUL]->(s:Soul)
          RETURN s as Soul`,
          { viewUsername }
        )
        ]);
  
        if (userQuery.records.length === 0) {
          throw new ValidationError(`User with username '${viewUsername}' not found.`, "");
        };
  
        const user = userQuery.records[0].get('u');
        let userSoul = {}
        if (soul.records.length === 0) {
          userSoul = {}
        }
        else{
          userSoul = soul.records[0].get('Soul').properties;
        }

        const { username, playerStats } = user.properties as ViewedUserData;

        const followsUser: boolean = followQuery.records.length > 0 ? followQuery.records[0].get('followsUser') : false;
        const followedByUser: boolean = followedByQuery.records.length > 0 ? followedByQuery.records[0].get('followedByUser') : false;
  
        return { username, playerStats, userSoul, followsUser, followedByUser } as ViewProfileData;
      });
  
      return result as ViewProfileData;
    } catch (error: any) {
      console.log(error);
      throw error;
    } finally {
      if (session) {
        await session.close();
      }
    }
  }
  

  //** Retrieves a list of users who are mutual followers with the specified user.
  public async getMutual(token: string): Promise<MutualData[]> {
    try {
      const tokenService: TokenService = new TokenService();
      const username: string = await tokenService.verifyAccessToken(token);
  
      const session: Session = this.driver.session();
      const result: QueryResult = await session.executeRead((tx: ManagedTransaction) =>
        tx.run(
          `
          MATCH (u1:User {username: $username})-[:FOLLOW]->(u2),
              (u2)-[:FOLLOW]->(u1)
          RETURN u2.username as username, u2.playerStats as playerStats
          `,
          { username }
        )
      );
      await session.close();
  
      const users: MutualData[] = result.records.map(record => ({
        username: record.get("username") || "",
        playerStats: record.get("playerStats") || ""
      })) as MutualData[];
  
      const usernames: string[] = users.map(user => user.username);
  
      const profileService: ProfileService = new ProfileService();
      const profilePics: ProfilePicture[] = await profileService.getDisplayPic(token, usernames);
      const myNotes: MyNote[] = await this.getMutualMyNotes(usernames);
  
      const usersWithProfilePics = users.map(user => {
        const profilePic: ProfilePicture | undefined = profilePics.find(pic => pic.userName === user.username);
        const note: MyNote | undefined = myNotes.find(note => note.userName === user.username);
        return {
          ...user,
          profilePicture: profilePic || null, // Add profilePicture data or null if not found
          myNote: note || null // Add myNote data or null if not found
        };
      });
  
      return usersWithProfilePics as MutualData[];
    } catch (error: any) {
      console.error("Something went wrong: ", error);
      throw error;
    }
  }


  public async getFollowersFollowingCount(token: string, username: string = "") {
    try {
      const tokenService: TokenService = new TokenService();
  
      // Use the passed username if it's not an empty string or null, otherwise verify the token
      const resolvedUsername: string = username && username.trim() !== "" ? username : await tokenService.verifyAccessToken(token);
    
      const session: Session = this.driver.session();
      const result: QueryResult = await session.executeRead((tx: ManagedTransaction) =>
        tx.run(getFollowersFollowingCountCypher,
          { username: resolvedUsername }
        )
      );
    
      await session.close();
    
      const followingCount = result.records[0].get("followingCount").toNumber();
      const followerCount = result.records[0].get("followerCount").toNumber();
    
      return { followingCount, followerCount };
    } catch (error) {
      console.error("Error fetching followers/following count:", error);
      throw error;
    }
  }
  


  public async getFollowersFollowing(token: string, username: string = "") {
    try {
      const tokenService: TokenService = new TokenService();
  
      // Use the passed username if it's not an empty string or null, otherwise verify the token
      const resolvedUsername: string = username && username.trim() !== "" ? username : await tokenService.verifyAccessToken(token);
  
      const session: Session = this.driver.session();
      const result: QueryResult = await session.executeRead((tx: ManagedTransaction) =>
        tx.run(
          `
            MATCH (u:User {username: $username})
            OPTIONAL MATCH (u)-[:FOLLOW]->(following:User)
            OPTIONAL MATCH (follower:User)-[:FOLLOW]->(u)
            RETURN 
              COLLECT(DISTINCT { username: following.username, level: following.level, playerStats: following.playerStats }) as followingUsers,
              COLLECT(DISTINCT { username: follower.username, level: follower.level, playerStats: follower.playerStats }) as followerUsers
          `,
          { username: resolvedUsername }
        )
      );
  
      await session.close();
  
      const followingUsers: { username: string, level: number, playerStats: any }[] = this.removeDuplicates(result.records[0].get("followingUsers"));
      const followerUsers: { username: string, level: number, playerStats: any }[] = this.removeDuplicates(result.records[0].get("followerUsers"));
  
      const profileService: ProfileService = new ProfileService();
  
      // Combine both following and followers usernames
      const allUsernames = [...new Set([...followingUsers.map(user => user.username), ...followerUsers.map(user => user.username)])];
  
      // Fetch profile pictures in a batch
      const profilePics: ProfilePicture[] = await profileService.getDisplayPic(token, allUsernames);
  
      // Map profile pictures by username
      const profilePicMap: { [key: string]: string | null } = {};
      for (const profile of profilePics) {
        profilePicMap[profile.userName] = profile.profilePicture;
      }
  
      // Assign profile pictures to following users
      for (const user of followingUsers) {
        //@ts-ignore
        user.profilePicture = profilePicMap[user.username] || null;
      }
  
      // Assign profile pictures to follower users
      for (const user of followerUsers) {
        //@ts-ignore
        user.profilePicture = profilePicMap[user.username] || null;
      }
  
      return { following: followingUsers, followers: followerUsers };
    } catch (error) {
      console.error("Error fetching followers and following users with profile pictures:", error);
      throw error;
    }
  }
  
  
  // Helper method to remove duplicates based on username
  private removeDuplicates(users: { username: string, level: number, playerStats: any }[]): { username: string, level: number, playerStats: any }[] {
    const uniqueUsers: { [key: string]: { username: string, level: number, playerStats: any } } = {};
    users.forEach(user => {
      uniqueUsers[user.username] = user;
    });
    return Object.values(uniqueUsers);
  }
  
  
  public async getMutualMyNotes(usernames: string[]): Promise<MyNote[]> {
    try {

      setInterval
      const connection: rt.Connection = await getRethinkDB();
      
      // Retrieve the latest note for the user
      const cursor: rt.Cursor = await rt
        .db('beats')
        .table('myNotes')
        .filter(usernames)
        .orderBy(rt.desc('createdAt'))
        .limit(1)
        .run(connection);
      
      const notesArray: MyNote[] = await cursor.toArray();
      
      const myNote: MyNote[] = notesArray;
  
      return myNote;
    } catch (error: any) {
      console.error("Error retrieving note:", error);
      throw error;
    }
  }
  

  //** Retrieves the online status of mutual followers for the specified user.
  public async mutualStatus(token: string): Promise<PlayerStatus[]> {
    try {
      const tokenService: TokenService = new TokenService();
      const username: string = await tokenService.verifyAccessToken(token);

      const session: Session = this.driver.session();
      const result: QueryResult = await session.executeRead((tx: ManagedTransaction) =>
        tx.run(
          `
          MATCH (u1:User {username: $username})-[:FOLLOW]->(u2),
                (u2)-[:FOLLOW]->(u1)
          RETURN COLLECT(u2.username) AS mutualFollowers
          `,
          { username }
        )
      );

      const mutualFollowers: string[] = result.records[0].get('mutualFollowers');

      // Close the Neo4j session
      await session.close();

      // RethinkDB query using the mutual followers' usernames
      const connection: rt.Connection = await getRethinkDB();
      const onlineMutuals: rt.Cursor = await rt
        .db('beats')
        .table('status')
        .getAll(...mutualFollowers)
        .limit(1)
        .orderBy(rt.desc('lastOnline'))
        .run(connection);

      const mutualsOnline = await onlineMutuals.toArray() as PlayerStatus[];
      return mutualsOnline;
    } catch (error: any) {
      throw error;
    }
  }


  //** Sets the online status for a user in the system.
  public async setStatusOnline(activity: string, userAgent: string, osName: string, ipAddress: string, token: string): Promise<void> {
    try {
      const tokenService: TokenService = new TokenService();
      const username: string = await tokenService.verifyAccessToken(token);

      const playerStatus: SetPlayerStatus = {
        username,
        status: true,
        activity,
        lastOnline: Date.now(),
        userAgent,
        osName,
        ipAddress,
      };

      const connection: rt.Connection = await getRethinkDB();
      await rt
        .db('beats')
        .table('status')
        .insert(playerStatus)
        .run(connection);
    } catch (error: any) {
      throw error;
    }
  }


  public async sendCardGift(token: string, cardGiftData: CardGiftData): Promise<SuccessMessage> {
    const session: Session | undefined = this.driver?.session();
    const tokenService: TokenService = new TokenService();
  
    try {
      const { receiver, cardName, id } = cardGiftData as CardGiftData
      const userName: string = await tokenService.verifyAccessToken(token);
      const result: QueryResult | undefined = await session?.executeRead((tx: ManagedTransaction) =>
        tx.run(`
        MATCH (u:User {username: $userName})-[:INVENTORY]->(c:Card {name: $name, id: $id})
        MATCH (r:User {username: $receiver})
        MATCH (u)-[:FOLLOW]->(r)
        MATCH (r)-[:FOLLOW]->(u)
        RETURN u.smartWalletAddress as smartWalletAddress, c as Card, r.smartWalletAddress as receiverWalletAddress, u.localWallet as localWallet, u.localWalletKey as localWalletKey`,
        { userName, name: cardName, id, receiver })
      );
  
      if (result && result.records.length > 0) {
        const record = result.records[0];
        const smartWalletAddress: string = record.get('smartWalletAddress');
        const receiverWalletAddress: string = record.get('receiverWalletAddress');
        const localWallet: string = record.get('localWallet');
        const localWalletKey: string = record.get('localWalletKey');
  
        // Call the cardGiftSending function with the obtained addresses and cardData

        const cardGiftSend: CardGiftSending = { localWallet, localWalletKey, senderWalletAddress: smartWalletAddress, receiverWalletAddress};
        await this.cardGiftSending(cardGiftData, cardGiftSend, userName);
      } else {
        throw new Error("No matching records found or users do not follow each other");
      }
  
      return new SuccessMessage("Card gift sent");
    } catch (error: any) {
      throw error;
    } finally {
      if (session) {
        await session.close();
      }
    }
  }
  

  private async cardGiftSending(cardGiftData: CardGiftData, cardGiftSending: CardGiftSending, userName: string) {
    try {

      await this.sendGiftFromWallet(cardGiftSending, cardGiftData); 
      const { receiver, id, cardName } = cardGiftData

      const session: Session | undefined = this.driver?.session();
      await session?.executeWrite((tx: ManagedTransaction) =>
        tx.run(`
        MATCH (u:User {username: $userName})-[e:INVENTORY]->(c:Card {name: $name, id: $id})
        MATCH (r:User {username: $receiver})
        CREATE (r)-[:INVENTORY]->(c)
        DELETE e`,
        { userName, name: cardName, id, receiver })
      );

    } catch (error: any) {
      console.error('Error sending card gift:', error);
      throw error;
    }
  }
  

  private async sendGiftFromWallet(cardGiftSending: CardGiftSending, cardData: CardGiftData) {
    try {

      const { localWalletKey, localWallet, receiverWalletAddress } = cardGiftSending;

      const wallet: LocalWalletNode = new LocalWalletNode({ chain: CHAIN });
      await wallet.import({
        encryptedJson: localWallet,
        password: localWalletKey,
      });

      // Connect the smart wallet
      const smartWallet: SmartWallet = new SmartWallet(SMART_WALLET_CONFIG);
      await smartWallet.connect({
        personalWallet: wallet,
      });

      // Use the SDK normally
      const sdk: ThirdwebSDK = await ThirdwebSDK.fromWallet(smartWallet, CHAIN, {
        secretKey: SECRET_KEY,
      });

      const cardContract: Edition = await sdk.getContract(EDITION_ADDRESS, 'edition');
      await cardContract.transfer(receiverWalletAddress, cardData.id, 1)

    } catch(error: any) {
      throw error
    }
  }


  public async postFanMoments(token: string, postFanMoment: PostFanMoment): Promise<SuccessMessage | Error> {

    try {
      const tokenService: TokenService = new TokenService();
      const userName: string = await tokenService.verifyAccessToken(token);
  
      const createdAt: number = Date.now();
      const postId: string = await nanoid();
  
      // Check if both caption and image are empty
      if (!(postFanMoment.image || (postFanMoment.caption && postFanMoment.caption.trim() !== ""))) {
        return new ValidationError("Post is empty", "Either caption or image is required.");
      }
  
      const post: PostFanMoment = { ...postFanMoment, userName, postId, createdAt, likes: [], comments: [], shares: [] };
  
      const connection: rt.Connection = await getRethinkDB();
      await rt
        .db('beats')
        .table('fanZone')
        .insert(post)
        .run(connection);
  
      return new SuccessMessage("Fanzone post success");
    } catch (error: any) {
      console.error("Error posting fan moment:", error);
      throw new Error(`Failed to post fan moment: ${error.message}`);
    }
  }


  public async getHotFanMomentPosts(token: string, limit: number, offset: number): Promise<PostFanMoment[]> {
    try {
      const tokenService: TokenService = new TokenService();
      const profileService: ProfileService = new ProfileService();
  
      await tokenService.verifyAccessToken(token);
  
      const connection: rt.Connection = await getRethinkDB();
      const cursor = await rt
        .db('beats')
        .table('fanZone')
        .orderBy(rt.desc('createdAt')) // Ensure that the data is ordered before pagination
        .slice(offset, offset + limit) // Use slice for pagination
        .run(connection);
  
      const posts: PostFanMoment[] = await cursor.toArray();
  
      const postsWithTrendScore = posts.map(post => ({
        ...post,
        trendScore: this.calculateTrendScore(post),
        formattedTime: this.formatTimeDifference(post.createdAt || 0)
      }));
  
      // Extract unique usernames from the posts
      const userNames: (string | undefined)[] = [...new Set(postsWithTrendScore.map(post => post.userName))];
      const profilePics: ProfilePicture[] = await profileService.getDisplayPic(token, userNames);
  
      // Map profile pictures to the corresponding posts
      const postsWithProfilePics = postsWithTrendScore.map(post => {
        const profilePic = profilePics.find(pic => pic.userName === post.userName);
        return {
          ...post,
          profilePic: profilePic ? profilePic.profilePicture : null
        };
      });
  
      // Sort posts by trend score in descending order
      postsWithProfilePics.sort((a, b) => b.trendScore - a.trendScore);
  
      return postsWithProfilePics;
    } catch (error: any) {
      console.error('Error retrieving hot fan moment posts:', error);
      throw new Error('Failed to retrieve hot fan moment posts');
    }
  }
  

  public async getMyFanMomentPosts(token: string, limit: number, offset: number): Promise<PostFanMoment[]> {
    try {
      const tokenService: TokenService = new TokenService();
      const profileService: ProfileService = new ProfileService();
  
      const userName: string = await tokenService.verifyAccessToken(token);
  
      const connection: rt.Connection = await getRethinkDB();
      const cursor = await rt
        .db('beats')
        .table('fanZone')
        .filter({ userName })
        .orderBy(rt.desc('createdAt')) // Ensure that the data is ordered before pagination
        .slice(offset, offset + limit) // Use slice for pagination
        .run(connection);
  
      const posts: PostFanMoment[] = await cursor.toArray();
  
      const userNames: (string | undefined)[] = [...new Set(posts.map(post => post.userName))];
      const profilePics: ProfilePicture[] = await profileService.getDisplayPic(token, userNames);
  
      const profilePicMap: { [key: string]: ProfilePicture } = {};
      profilePics.forEach(pic => {
        if (pic.userName) {
          profilePicMap[pic.userName] = pic;
        }
      });
  
      const postsWithProfilePics = posts.map(post => ({
        ...post,
        profilePicture: post.userName ? profilePicMap[post.userName] : undefined,
        formattedTime: this.formatTimeDifference(post.createdAt || 0)
      }));
  
      return postsWithProfilePics;
    } catch (error: any) {
      console.error('Error retrieving my fan moment posts:', error);
      throw new Error('Failed to retrieve my fan moment posts');
    }
  }


  public async getLatestFanMomentPosts(token: string, limit: number, offset: number): Promise<PostFanMoment[]> {
    try {
      const tokenService: TokenService = new TokenService();
      const profileService: ProfileService = new ProfileService();
  
      await tokenService.verifyAccessToken(token);
  
      const connection: rt.Connection = await getRethinkDB();
      const cursor = await
        rt.db('beats')
        .table('fanZone')
        .orderBy(rt.asc('createdAt')) // Ensure that the data is ordered before pagination
        .slice(offset, offset + limit) // Use slice for pagination
        .run(connection);
  
      const posts: PostFanMoment[] = await cursor.toArray();
  
      const userNames: (string | undefined)[] = [...new Set(posts.map(post => post.userName))];
      const profilePics: ProfilePicture[] = await profileService.getDisplayPic(token, userNames);
  
      const profilePicMap: { [key: string]: ProfilePicture } = {};
      profilePics.forEach(pic => {
        if (pic.userName) {
          profilePicMap[pic.userName] = pic;
        }
      });
  
      const postsWithProfilePics = posts.map(post => ({
        ...post,
        profilePicture: post.userName ? profilePicMap[post.userName] : undefined,
        formattedTime: this.formatTimeDifference(post.createdAt || 0)
      }));
  
      return postsWithProfilePics;
    } catch (error: any) {
      console.error('Error retrieving my fan moment posts:', error);
      throw new Error('Failed to retrieve my fan moment posts');
    }
  }
  

  public async getFollowingMomentPosts(token: string, limit: number, offset: number): Promise<PostFanMoment[]> {
    try {
      const tokenService: TokenService = new TokenService();
      const profileService: ProfileService = new ProfileService();
      const userName: string = await tokenService.verifyAccessToken(token);
  
      const session: Session = this.driver.session();
      const result: QueryResult = await session.executeRead((tx: ManagedTransaction) =>
        tx.run(
          `
          MATCH (u1:User {username: $userName})-[:FOLLOW]->(u2)
          RETURN COLLECT(u2.username) AS followingUsernames
          `,
          { userName }
        )
      );
  
      const followingUsernames = result.records[0].get('followingUsernames') as string[];
  
      if (followingUsernames.length === 0) {
        return [];
      }
  
      const connection: rt.Connection = await getRethinkDB();
      const cursor = await rt
        .db('beats')
        .table('fanZone')
        .filter(followingUsernames)
        .orderBy(rt.desc('uploadedAt')) // Ensure that the data is ordered before pagination
        .slice(offset, offset + limit) // Use slice for pagination
        .run(connection);
  
      const posts: PostFanMoment[] = await cursor.toArray();
  
      const userNames: (string | undefined)[] = [...new Set(posts.map(post => post.userName))];
      const profilePics: ProfilePicture[] = await profileService.getDisplayPic(token, userNames);
  
      const profilePicMap: { [key: string]: ProfilePicture } = {};
      profilePics.forEach(pic => {
        if (pic.userName) {
          profilePicMap[pic.userName] = pic;
        }
      });
  
      const postsWithProfilePics = posts.map(post => ({
        ...post,
        profilePicture: post.userName ? profilePicMap[post.userName] : undefined,
        formattedTime: this.formatTimeDifference(post.createdAt || 0)
      }));
  
      return postsWithProfilePics;
    } catch (error: any) {
      console.error('Error retrieving following moment posts:', error);
      throw new Error('Failed to retrieve following moment posts');
    }
  }
  

	private calculateTrendScore(post: PostFanMoment): number {
		const W_likes: number = 1;
		const W_comments: number = 2;
		const W_shares: number = 3;

		const likesCount: number = post.likes ? post.likes.length : 0;
		const commentsCount: number = post.comments ? post.comments.length : 0;
		const sharesCount: number = post.shares ? post.shares.length : 0;
		const trendScore: number = (likesCount * W_likes) + (commentsCount * W_comments) + (sharesCount * W_shares);
		return trendScore;
	}


  private formatTimeDifference(createdAt: number): string {
    const now = Date.now();
    const diff = now - createdAt;

    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 60) return `${minutes}min`;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h`;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 365) return `${days}D`;

    const years = Math.floor(days / 365);
    return `${years}y`;
  }


  public async likeFanMoment(token: string, fanMomentId: FanMomentId) {
    try {
      const tokenService: TokenService = new TokenService();
      const userName: string = await tokenService.verifyAccessToken(token);

      const connection: rt.Connection = await getRethinkDB();

      const query: PostFanMoment = await rt
        .db('beats')
        .table('fanZone')
        .get(fanMomentId.id)
        .run(connection) as PostFanMoment;

      if (!query) {
        throw new ValidationError(`Fan moment with ID '${fanMomentId.id}' not found.`, "");
      }

      const likeIndex: number = query.likes ? query.likes.findIndex(like => like === userName) : -1;

      if (likeIndex === -1) {
        // User has not liked this post yet, add the like
        await rt
          .db('beats')
          .table('fanZone')
          .get(fanMomentId.id)
          .update({
            likes: rt.row('likes').default([]).append(userName)
          })
          .run(connection);

        return new SuccessMessage("Fan moment liked successfully")
      } else {
        return new Error('User has already liked this fan moment')
      }
    } catch (error: any) {
      console.error('Error liking fan moment:', error);
      throw new Error(`Failed to like fan moment: ${error.message}`);
    }
  }


  public async unlikeFanMoment(token: string, fanMomentId: FanMomentId) {
    try {
      const tokenService: TokenService = new TokenService();
      const userName: string = await tokenService.verifyAccessToken(token);

      const connection: rt.Connection = await getRethinkDB();

      const query: PostFanMoment = await rt
        .db('beats')
        .table('fanZone')
        .get(fanMomentId.id)
        .run(connection) as PostFanMoment;

      if (!query) {
        throw new ValidationError(`Fan moment with ID '${fanMomentId.id}' not found.`, "");
      }

      const likes = query.likes || [];
      const likeIndex = likes.findIndex(like => like === userName);

      if (likeIndex !== -1) {
        // User has liked this post, remove the like
        likes.splice(likeIndex, 1);

        await rt
          .db('beats')
          .table('fanZone')
          .get(fanMomentId.id)
          .update({ likes: likes })
          .run(connection);

        return new SuccessMessage('Fan moment unliked successfully')
      } else {
        return new Error('User has not liked this fan moment');
      }
    } catch (error: any) {
      console.error('Error unliking fan moment:', error);
      throw new Error(`Failed to unlike fan moment: ${error.message}`);
    }
  }

  
  public async commentFanMoment(token: string, fanMomentComment: FanMomentComment): Promise<SuccessMessage> {
    try {
      const tokenService: TokenService = new TokenService();
      const userName: string = await tokenService.verifyAccessToken(token);
  
      const connection: rt.Connection = await getRethinkDB();
  
      const { id, comment } = fanMomentComment;
      const query: PostFanMoment = await rt
        .db('beats')
        .table('fanZone')
        .get(id)
        .run(connection) as PostFanMoment;
  
      if (!query) {
        throw new ValidationError(`Fan moment with ID '${fanMomentComment.id}' not found.`, "");
      }
  
      const timestamp: number = Date.now();
      const commentId: string = await nanoid();
      const newComment: PostComment = { userName, timestamp, commentId, comment };
  
      // If the comments array does not exist, initialize it
      if (!query.comments) {
        query.comments = [];
      }
  
      // Add the new comment to the comments array
      query.comments.push(newComment);
  
      // Update the fan moment with the new comments array
      await rt
        .db('beats')
        .table('fanZone')
        .get(id)
        .update({ comments: query.comments })
        .run(connection);
      
      return new SuccessMessage("Comment has been added")
    } catch (error: any) {
      console.error("Error commenting on fan moment:", error);
      throw error;
    }
  }
  

}


export default SocialService