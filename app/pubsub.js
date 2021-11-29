const redis = require('redis');
const dotenv = require('dotenv');
dotenv.config();

const CHANNELS = {
  TEST: 'TEST',
  WALLET: 'WALLET',
  BLOCKCHAIN: 'BLOCKCHAIN',
  TRANSACTION: 'TRANSACTION'
};

class PubSub {
  constructor({ blockchain, transactionPool, redisUrl }) {
    this.blockchain = blockchain;
    this.transactionPool = transactionPool;

    this.publisher = redis.createClient(redisUrl);
    this.publisher.auth(process.env.REDIS_SECRET_KEY);
    this.subscriber = redis.createClient(redisUrl);
    this.subscriber.auth(process.env.REDIS_SECRET_KEY);
    // this.subscriber.auth('af44a39972b2b80bcb203d13e0cb61c3eddecb9a9204f0609441c4ef35c3ced8');

    this.subscribeToChannels();

    this.subscriber.on(
      'message',
      (channel, message) => this.handleMessage(channel, message)
    );
  }

  handleMessage(channel, message) {
    console.log(`Message received. Channel: ${channel}. Message: ${message}.`);

    const parsedMessage = JSON.parse(message);

    switch(channel) {
      case CHANNELS.BLOCKCHAIN:
        this.blockchain.replaceChain(parsedMessage, true, () => {
          this.transactionPool.clearBlockchainTransactions({
            chain: parsedMessage
          });
        });
        break;
      case CHANNELS.TRANSACTION:
        this.transactionPool.setTransaction(parsedMessage);
        break;
      default:
        return;
    }
  }

  subscribeToChannels() {
    Object.values(CHANNELS).forEach(channel => {
      this.subscriber.subscribe(channel);
    });
  }

  publish({ channel, message }) {
    this.subscriber.unsubscribe(channel, () => {
      this.publisher.publish(channel, message, () => {
        this.subscriber.subscribe(channel);
      });
    });
  }

  broadcastChain() {
    this.publish({
      channel: CHANNELS.BLOCKCHAIN,
      message: JSON.stringify(this.blockchain.chain)
    });
  }

  broadcasrWallet(wallet) {
    this.publish({
      channel: CHANNELS.WALLET,
      message: JSON.stringify(wallet)
    })
  }

  broadcastTransaction(transaction) {
    this.publish({
      channel: CHANNELS.TRANSACTION,
      message: JSON.stringify(transaction)
    });
  }
}

module.exports = PubSub;
