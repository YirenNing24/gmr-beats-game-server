import { createClient } from 'redis';
import { KEYDB_HOST, KEYDB_PORT, KEYDB_PASSWORD } from '../config/constants';

const keydbUrl = `redis://:${KEYDB_PASSWORD}@${KEYDB_HOST}:${KEYDB_PORT}`;

const keydb = createClient({ url: keydbUrl });

// Listen for error events
keydb.on('error', err => console.log('KeyDB Client Error', err));

// Add success message on successful connection
keydb.on('connect', () => {
    console.log('Successfully connected to KeyDB!');
});

await keydb.connect();

export default keydb;
