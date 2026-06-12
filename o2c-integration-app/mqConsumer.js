const mq = require('ibmmq');
const MQC = mq.MQC;
const config = require('./config');
const logger = require('./logger');

class MQConsumer {
  constructor() {
    this.qMgr = null;
    this.queueObj = null;
    this.connected = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const cno = new mq.MQCNO();
      const cd = new mq.MQCD();
      
      cd.ConnectionName = `${config.mq.host}(${config.mq.port})`;
      cd.ChannelName = config.mq.channel;
      
      const csp = new mq.MQCSP();
      csp.UserId = config.mq.user;
      csp.Password = config.mq.password;
      
      cno.ClientConn = cd;
      cno.SecurityParms = csp;
      cno.Options = MQC.MQCNO_CLIENT_BINDING;

      logger.info('Connecting to IBM MQ...', {
        host: config.mq.host,
        port: config.mq.port,
        queueManager: config.mq.queueManager
      });

      mq.Connx(config.mq.queueManager, cno, (err, hConn) => {
        if (err) {
          logger.error('Failed to connect to MQ', { error: err.message });
          return reject(err);
        }

        this.qMgr = hConn;
        logger.info('Connected to IBM MQ successfully');

        const od = new mq.MQOD();
        od.ObjectName = config.mq.queueName;
        od.ObjectType = MQC.MQOT_Q;

        const openOptions = MQC.MQOO_INPUT_AS_Q_DEF | MQC.MQOO_FAIL_IF_QUIESCING;

        mq.Open(hConn, od, openOptions, (err, hObj) => {
          if (err) {
            logger.error('Failed to open queue', { 
              queue: config.mq.queueName,
              error: err.message 
            });
            return reject(err);
          }

          this.queueObj = hObj;
          this.connected = true;
          logger.info('Queue opened successfully', { queue: config.mq.queueName });
          resolve();
        });
      });
    });
  }

  async getMessage() {
    if (!this.connected) {
      throw new Error('Not connected to MQ');
    }

    return new Promise((resolve, reject) => {
      const md = new mq.MQMD();
      const gmo = new mq.MQGMO();
      
      gmo.Options = MQC.MQGMO_NO_SYNCPOINT |
                    MQC.MQGMO_WAIT |
                    MQC.MQGMO_CONVERT |
                    MQC.MQGMO_FAIL_IF_QUIESCING;
      gmo.WaitInterval = 3000; // 3 seconds

      mq.Get(this.queueObj, md, gmo, (err, hObj, gmo, md, buf) => {
        if (err) {
          if (err.mqrc === MQC.MQRC_NO_MSG_AVAILABLE) {
            return resolve(null); // No message available
          }
          logger.error('Error getting message from queue', { error: err.message });
          return reject(err);
        }

        try {
          const message = buf.toString('utf8');
          logger.info('Message received from MQ', { 
            messageId: md.MsgId.toString('hex'),
            length: message.length 
          });
          resolve(message);
        } catch (parseErr) {
          logger.error('Error parsing message', { error: parseErr.message });
          reject(parseErr);
        }
      });
    });
  }

  async disconnect() {
    return new Promise((resolve) => {
      if (this.queueObj) {
        mq.Close(this.queueObj, 0, (err) => {
          if (err) {
            logger.warn('Error closing queue', { error: err.message });
          } else {
            logger.info('Queue closed');
          }
          this.queueObj = null;
        });
      }

      if (this.qMgr) {
        mq.Disc(this.qMgr, (err) => {
          if (err) {
            logger.warn('Error disconnecting from MQ', { error: err.message });
          } else {
            logger.info('Disconnected from IBM MQ');
          }
          this.qMgr = null;
          this.connected = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async reconnect() {
    logger.info('Attempting to reconnect to MQ...');
    await this.disconnect();
    await new Promise(resolve => setTimeout(resolve, config.app.retryDelayMs));
    await this.connect();
  }
}

module.exports = MQConsumer;

// Made with Bob
