import { MongoClient, ServerApiVersion } from "mongodb";

// Connection URI with environment variables
const uri = `mongodb://${process.env.MONGO_INITDB_ROOT_USERNAME}:${process.env.MONGO_INITDB_ROOT_PASSWORD}@96.9.211.82:27018?tls=true`; 

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
export const mongoDBClient = new MongoClient(uri,  {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    
    },tlsAllowInvalidCertificates: true, ssl: true
}
);

async function run() {
try {
// Connect the client to the server (optional starting in v4.7)
await mongoDBClient.connect();
// Send a ping to confirm a successful connection
await mongoDBClient.db("admin").command({ ping: 1 });
console.log("Pinged your deployment. You successfully connected to MongoDB!");
} finally {
// Ensures that the client will close when you finish/error
await mongoDBClient.close();
}
}
run().catch(console.dir);
