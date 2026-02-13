import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3030', 10),
  auth: {
    username: process.env.QN_BASIC_AUTH_USERNAME || 'quicknode',
    password: process.env.QN_BASIC_AUTH_PASSWORD || 'changeme',
  },
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'qn-addon.db'),
};
