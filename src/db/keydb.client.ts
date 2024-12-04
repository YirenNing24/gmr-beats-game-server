import { createClient } from 'redis';
import { KEYDB_HOST, KEYDB_PORT,KEYDB_PASSWORD } from '../config/constants';

const keydb = createClient({ url:`redis://:${KEYDB_PASSWORD}@${KEYDB_HOST}:${KEYDB_PORT}`});
// const keydb = createClient({ url:`redis://${HOST}:${KEYDB_PORT}`});

keydb.on('error', err => console.log('KeyDB Client Error', err));

await keydb.connect();


export default keydb