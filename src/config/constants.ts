import { Arbitrum } from "@thirdweb-dev/chains";



// API Configuration
export const API_PREFIX: string = process.env.API_PREFIX || '/api';
export const APP_PORT: number = Number(process.env.APP_PORT) || 8085;
export const PORT: number = Number(process.env.PORT) || 8085;
export const API_KEY: string | undefined = process.env.API_KEY;
export const API_ID: string | undefined = process.env.API_ID;
export const HOST: string = process.env.HOST || 'localhost';
export const JWT_SECRET: string = process.env.JWT_SECRET || 'a secret key';
export const SALT_ROUNDS: string | "" = process.env.SALT_ROUNDS || ""

// Neo4j Database Configuration
export const NEO4J_URI: string = process.env.NEO4J_URI || ""
export const NEO4J_USERNAME: string  = process.env.NEO4J_USERNAME || ""
export const NEO4J_PASSWORD: string = process.env.NEO4J_PASSWORD || ""

// RethinkDB Configuration
export const RDB_DATABASE: string = process.env.RDB_DATABASE || ""
export const RDB_PORT: number = Number(process.env.RDB_PORT) || 28015;

export const MONGO_HOST: string = process.env.MONGO_HOST || "";
export const MONGO_TIMEOUT_MS: number = Number(process.env.MONGO_TIMEOUT_MS) || 20000;
export const MONGO_SOCKET_TIMEOUT_MS: number = Number(process.env.MONGO_SOCKET_TIMEOUT_MS) || 20000;
export const MONGO_TLS: string = process.env.MONGO_TLS || "true"


// KeyDB Configuration
export const KEYDB_PASSWORD: string | undefined = process.env.KEYDB_PASSWORD;
export const KEYDB_PORT: number  = Number(process.env.KEYDB_PORT) || 6379;
export const KEYDB_HOST: string | undefined = process.env.KEYDB_HOST;
export const ENGINE_URI: string = process.env.ENGINE_URI || "https://docker.gmetarave.com:3005";

export const KDB: { host: string | undefined; port: string | number; password: string | undefined } = {
  host: process.env.KEYDB_HOST,
  port: process.env.KEYDB_PORT || 6379,
  password: process.env.KEYDB_PASSWORD,
};

// Thirdweb SDK Configuration
export const SECRET_KEY: string = process.env.SECRET_KEY || ""
// Chain and Wallet Factory Configuration
export const CHAIN: string  = process.env.CHAIN || "33139";
// Contract Addresses
export const BEATS_TOKEN: string = '0xAA95DA3D6EbdAb099630b6d4Cf0fcb904a44C2ab';
export const GMR_TOKEN: string = '0x7dce27C81b7e112018FA6C2e27f8444b5D39688B';

export const PACK_ADDRESS: string = '0x3B88F847236Dd2CbD24796F0b8Da6cf0DC111701';
export const EDITION_ADDRESS: string = '0x7536D6d120C6a7ee50B792b33862A74E6f404589'; // ** NFT CARD ADDRESS
export const CARD_MARKETPLACE: string = '0x033d72A6fACD989396D64D9704ED57F7cABF2Ebc'; // ** CARD MARKETPLACE ADDRESS
export const CARD_UPGRADE_MARKETPLACE: string = '0x001dC831E422cd8924A806bA41da5A91A09dFc35'; // ** CARD MARKETPLACE ADDRESS
export const PACK_MARKETPLACE: string = '0x1c23651182a1742E87188BA53E29564f37c6Af74'; // ** CARD PACK MARKETPLACE ADDRESS
export const CARD_UPGRADE: string = '0xac8aADf1dB87A6193E306884aB57940f72986a53'; 
export const SOUL_ADDRESS: string = '0xc465946c70C08e438294824050B51cfb77aEe2A5';
export const SOCIAL_BADGES_ADDRESS: string = '0xa98d398DA254Cda866acae71592ac8E12581AF19';
export const PRIVATE_KEY: string  = process.env.THIRDWEB_AUTH_PRIVATE_KEY || ""

export const ENGINE_ACCESS_TOKEN: string = process.env.ENGINE_ACCESS_TOKEN || ""
export const ENGINE_ADMIN_WALLET_ADDRESS: string = process.env.ENGINE_ADMIN_WALLET_ADDRESS || ""

export const GOOGLE_CLIENT_ID: string  = process.env.GOOGLE_CLIENT_ID || ""
export const GOOGLE_CLIENT_SECRET: string = process.env.GOOGLE_CLIENT_SECRET || ""

export const GAME_SERVER_KEY: string = process.env.GAME_SERVER_KEY || ""
export const ANDROID_APP_HASH: string = process.env.ANDROID_APP_HASH || ""


