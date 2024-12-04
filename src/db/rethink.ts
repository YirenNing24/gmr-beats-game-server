import rt, { ConnectionOptions } from 'rethinkdb';
import { HOST, RDB_PORT } from '../config/constants';

let rdbConn: rt.Connection | null = null;

const rdbConnect = async (): Promise<rt.Connection> => {
  try {
    const options: ConnectionOptions = {
      host: HOST,
      port: RDB_PORT,
    };

    const connection: rt.Connection = await rt.connect(options);

    // Handle close
    connection.on('close', (error: any) => {
      console.log('RDB connection closed: ', error);
      rdbConn = null;
    });

    rdbConn = connection;
    return connection;
  } catch (error: any) {
    throw error;
  }
};

export const getRethinkDB = async (): Promise<rt.Connection> => {
  if (rdbConn !== null) {
    return rdbConn;
  }
  return await rdbConnect();
};