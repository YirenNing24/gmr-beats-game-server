import { MongoClient, ServerApiVersion } from "mongodb";
import { MONGO_HOST, MONGO_SOCKET_TIMEOUT_MS, MONGO_TIMEOUT_MS, MONGO_TLS } from "../config/constants";

// Convert MONGO_TLS to boolean
const tlsEnabled: boolean = MONGO_TLS === "true";

// Connection URI with environment variables
const uri: string = `mongodb://${process.env.MONGO_INITDB_ROOT_USERNAME}:${process.env.MONGO_INITDB_ROOT_PASSWORD}@${MONGO_HOST}`;

export const mongoDBClient = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
	tlsAllowInvalidCertificates: tlsEnabled,
	tls: tlsEnabled,

	// ✅ Increase timeouts to handle network fluctuations
	connectTimeoutMS: 30000,
	socketTimeoutMS: 60000,
	serverSelectionTimeoutMS: 15000,
	heartbeatFrequencyMS: 10000,

	// ✅ Connection Pooling
	minPoolSize: 10,
	maxPoolSize: 100,
	maxIdleTimeMS: 60000,

	// ✅ Retry Mechanisms
	retryWrites: true,
	retryReads: true,

	// ✅ Automatic Compression
});

let isMongoConnected = false;

// ✅ Ping MongoDB every 30 seconds to keep the connection alive
async function keepMongoAlive() {
	try {
		await mongoDBClient.db().admin().ping();
		console.log("✅ MongoDB Ping: Connection is alive");
	} catch (error) {
		console.error("❌ MongoDB Ping Failed:", error);
	}
}

export async function initMongoDB(): Promise<void> {
	try {
		console.log("🔄 Connecting to MongoDB...");
		await mongoDBClient.connect();
		isMongoConnected = true;
		console.log("✅ MongoDB connected successfully.");

		// Start pinging MongoDB every 30s
		setInterval(keepMongoAlive, 30000);
	} catch (error) {
		console.error("❌ Failed to connect to MongoDB:", error);
		process.exit(1);
	}
}

// Handle unexpected disconnects
mongoDBClient.on("close", () => {
	isMongoConnected = false;
	console.error("❌ MongoDB connection closed.");
});

mongoDBClient.on("error", (error) => {
	isMongoConnected = false;
	console.error("❌ MongoDB error:", error);
});
