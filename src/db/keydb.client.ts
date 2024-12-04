import { createClient } from 'redis';
import { HOST, KEYDB_PORT } from '../config/constants';

// const keydb = createClient({ url:`redis://:${KEYDB_PASSWORD}@${HOST}:${KEYDB_PORT}`});
const keydb = createClient({ url:`redis://${HOST}:${KEYDB_PORT}`});
console.log(`redis://${HOST}:${KEYDB_PORT}`)

keydb.on('error', err => console.log('KeyDB Client Error', err));

await keydb.connect();


export default keydb