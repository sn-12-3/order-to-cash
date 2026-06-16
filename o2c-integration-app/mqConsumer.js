const mq = require('ibmmq');
const config = require('./config');
const logger = require('./logger');

class MQConsumer {
  constructor() {
    this.MAX_MESSAGE_SIZE = 10240; // 10KB max message size
    this.WAIT_INTERVAL_MS = 3000; // Wait timeout for message retrieval
    
    this.qMgr = null;
    this.queue = null;
    this.connected = false;
  }

  async connect(retries = 10, delay = 5000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.info(`Connecting to IBM MQ (attempt ${attempt}/${retries})...`, {
          queueManager: config.mq.queueManager,
          host: config.mq.host,
          port: config.mq.port,
          channel: config.mq.channel
        });

        const cno = new mq.MQCNO();
        cno.Options = mq.MQC.MQCNO_CLIENT_BINDING;

        const cd = new mq.MQCD();
        cd.ConnectionName = `${config.mq.host}(${config.mq.port})`;
        cd.ChannelName = config.mq.channel;

        cno.ClientConn = cd;

        if (config.mq.user) {
          const csp = new mq.MQCSP();
          csp.UserId = config.mq.user;
          csp.Password = config.mq.password;
          cno.SecurityParms = csp;
        }

        this.qMgr = await new Promise((resolve, reject) => {
          mq.Connx(config.mq.queueManager, cno, (error, queueManager) => {
            if (error) {
              reject(error);
            } else {
              resolve(queueManager);
            }
          });
        });

        const od = new mq.MQOD();
        od.ObjectName = config.mq.queueName;
        od.ObjectType = mq.MQC.MQOT_Q;

        const openOptions = mq.MQC.MQOO_INPUT_AS_Q_DEF | mq.MQC.MQOO_FAIL_IF_QUIESCING;

        this.queue = await new Promise((resolve, reject) => {
          mq.Open(this.qMgr, od, openOptions, (error, queueHandle) => {
            if (error) {
              reject(error);
            } else {
              resolve(queueHandle);
            }
          });
        });

        this.connected = true;
        logger.info('Successfully connected to IBM MQ');
        return true;
      } catch (error) {
        logger.warn(`MQ connection attempt ${attempt}/${retries} failed`, {
          error: error.message,
          mqrc: error.mqrc,
          mqrcstr: error.mqrcstr
        });

        if (attempt < retries) {
          logger.info(`Retrying in ${delay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to connect to IBM MQ after ${retries} attempts`);
  }

  async getMessage() {
    if (!this.connected || !this.queue) {
      throw new Error('Not connected to MQ');
    }

    try {
      const md = new mq.MQMD();
      const gmo = new mq.MQGMO();
      gmo.Options = mq.MQC.MQGMO_NO_WAIT | mq.MQC.MQGMO_FAIL_IF_QUIESCING | mq.MQC.MQGMO_CONVERT;
      gmo.WaitInterval = this.WAIT_INTERVAL_MS;

      const buf = Buffer.alloc(this.MAX_MESSAGE_SIZE);

      return await new Promise((resolve, reject) => {
        mq.GetSync(this.queue, md, gmo, buf, (error, len) => {
          if (error) {
            // Check if it's just "no message available"
            if (error && typeof error === 'object' && 'mqrc' in error) {
              if (error.mqrc === mq.MQC.MQRC_NO_MSG_AVAILABLE) {
                resolve(null);
                return;
              }
            }
            reject(error);
          } else {
            const content = buf.slice(0, len).toString('utf8').trim();
            resolve(content);
          }
        });
      });
    } catch (error) {
      logger.error('Error getting message from MQ', {
        error: error.message,
        mqrc: error.mqrc,
        mqrcstr: error.mqrcstr
      });
      throw error;
    }
  }

  async reconnect() {
    logger.info('Attempting to reconnect to IBM MQ...');
    try {
      await this.disconnect();
      await this.connect();
      logger.info('Successfully reconnected to IBM MQ');
    } catch (error) {
      logger.error('Failed to reconnect to IBM MQ', {
        error: error.message
      });
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.queue) {
        await new Promise((resolve, reject) => {
          mq.Close(this.queue, 0, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
        this.queue = null;
      }

      if (this.qMgr) {
        await new Promise((resolve, reject) => {
          mq.Disc(this.qMgr, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
        this.qMgr = null;
      }

      this.connected = false;
      logger.info('Disconnected from IBM MQ');
    } catch (error) {
      logger.error('Error disconnecting from MQ', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = MQConsumer;

// Made with Bob
