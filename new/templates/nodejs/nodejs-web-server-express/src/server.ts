import mongoose from 'mongoose';

import { app } from './app.js';
import config from './config/config.js';
import logger from './config/logger.js';

let server;
mongoose.connect(config.mongoose.url, config.mongoose.options as any).then(() => {
  logger.info('Connected to MongoDB');

  server = app.listen(config.port, () => {
    logger.info(`Listening to port ${config.port}`);
  });
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

process.on('uncaughtException', (error) => {
  logger.error(error);
  exitHandler();
});

process.on('unhandledRejection', (error) => {
  logger.error(error);
  exitHandler();
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
