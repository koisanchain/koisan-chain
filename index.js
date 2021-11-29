const bodyParser = require('body-parser');
const express = require('express');
const request = require('request');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();
const Blockchain = require('./blockchain');
const PubSub = require('./app/pubsub');
const TransactionPool = require('./wallet/transaction-pool');
const Wallet = require('./wallet');
const TransactionMiner = require('./app/transaction-miner');
const { exit } = require('process');
var Datastore = require('nedb')
  , db = new Datastore({ filename: 'wallet.db', autoload: true });

const isDevelopment = process.env.ENV === 'development';

const REDIS_URL = isDevelopment ?
  'redis://127.0.0.1:6379' :
  process.env.MASTER_NODE;
const DEFAULT_PORT = 3000;
const ROOT_NODE_ADDRESS = `http://localhost:${DEFAULT_PORT}`;

const app = express();
const blockchain = new Blockchain();
const transactionPool = new TransactionPool();

var wallets = []
//create main wallet
db.findOne({'main' : 1}, function (err, doc) {
  if(!doc) {
    var wallet = new Wallet(alias= "", label= "main");
    var values = {
      alias: wallet.alias,
      label: wallet.label,
      seeds: wallet.seeds,
      balance: wallet.balance,
      keyPair: JSON.stringify(wallet.keyPair),
      publicKey: wallet.publicKey,
      main: 1
    }

    wallets.push(wallet)
    db.insert([values], function(err, newDoc) {
      // console.log(newDoc)
    });
  } else {
    var wallet = new Wallet(alias=doc.alias, label=doc.label, seeds=doc.seeds, privateKey= "", publicKey = doc.publicKey, balance=doc.balance, keyPair=doc.keyPair);
    wallets.push(wallet)
  }
});

var wallet = new Wallet()

// var wallet = wallets[0]

console.log(wallets)


// exit()
const pubsub = new PubSub({ blockchain, transactionPool, redisUrl: REDIS_URL });
// const pubsub = new PubSub({ blockchain, transactionPool, wallet }); // for PubNub
const transactionMiner = new TransactionMiner({ blockchain, transactionPool, wallet, pubsub });

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

app.get('/api/getbestblockhash', (req, res) => {
  res.json(blockchain.chain[blockchain.chain.length-1]);
})

app.get('/api/getblockbyhash/:hash', (req, res) => {
  const { hash } = req.params;
  res.json(blockchain.chain.find(o => o.hash === hash));
})

app.get('/api/getblockcount', (req, res) => {
  res.json(blockchain.chain.length);
})

app.get('/api/getnewaddress', (req, res) => {
  var newWallet = new Wallet();
  res.json(newWallet.publicKey);
})

app.get('/api/getblockhash/:id', (req, res) => {
  const { id } = req.params;

  var result = blockchain.chain[parseInt(id)+1];
  if (!result)
    result = 'undefined'
  else
    result = result.hash

  res.json(result);
})

app.get('/api/getrawtransaction/:txid', (req, res) => {
  const { txid } = req.params;
  var result = '';
  res.json(result);
})

app.get('/api/getwalletbalance/:address', (req, res) => {
  const { address } = req.params;

  res.json(Wallet.calculateBalance({ chain: blockchain.chain, address }));
})

app.get('/api/validateaddress/:address', (req, res) => {
  const { address } = req.params;

  res.json(Wallet.calculateBalance({ chain: blockchain.chain, address }));
})

app.get('/api/listaddress', (req, res) => {
  var addresses = []
  wallets.forEach(address => {
    addresses.push(address.publicKey)
  })
  res.json(addresses);
});

app.post('/api/sendtoaddress', (req, res) => {
  
})


app.get('/getTransactionByHash', (req, res) => {
  res.json(blockchain.chain.length);
})

app.get('/api/blocks', (req, res) => {
  res.json(blockchain.chain);
});

app.get('/api/blocks/length', (req, res) => {
  res.json(blockchain.chain.length);
});

app.get('/api/blocks/:id', (req, res) => {
  const { id } = req.params;
  const { length } = blockchain.chain;

  const blocksReversed = blockchain.chain.slice().reverse();

  let startIndex = (id-1) * 5;
  let endIndex = id * 5;

  startIndex = startIndex < length ? startIndex : length;
  endIndex = endIndex < length ? endIndex : length;

  res.json(blocksReversed.slice(startIndex, endIndex));
});

app.post('/api/mine', (req, res) => {
  const { data } = req.body;

  blockchain.addBlock({ data });

  pubsub.broadcastChain();

  res.json(blockchain);

  // res.redirect('/api/blocks');
});


app.post('/api/transact', (req, res) => {
  console.log(req.body)
  // const { amount, recipient } = req.body;

  // let transaction = transactionPool
  //   .existingTransaction({ inputAddress: wallet.publicKey });

  // try {
  //   if (transaction) {
  //     transaction.update({ senderWallet: wallet, recipient, amount });
  //   } else {
  //     transaction = wallet.createTransaction({
  //       recipient,
  //       amount,
  //       chain: blockchain.chain
  //     });
  //   }
  // } catch(error) {
  //   return res.status(400).json({ type: 'error', message: error.message });
  // }

  // transactionPool.setTransaction(transaction);

  // pubsub.broadcastTransaction(transaction);

  // res.json({ type: 'success', transaction });
});

app.get('/api/transaction-pool-map', (req, res) => {
  res.json(transactionPool.transactionMap);
});

app.get('/api/mine-transactions', (req, res) => {
  transactionMiner.mineTransactions();

  res.redirect('/api/blocks');
});

app.get('/api/wallet-info', (req, res) => {
  const address = wallet.publicKey;

  res.json({
    address,
    balance: Wallet.calculateBalance({ chain: blockchain.chain, address })
  });
});

app.get('/api/known-addresses', (req, res) => {
  const addressMap = {};

  for (let block of blockchain.chain) {
    for (let transaction of block.data) {
      const recipient = Object.keys(transaction.outputMap);

      recipient.forEach(recipient => addressMap[recipient] = recipient);
    }
  }

  res.json(Object.keys(addressMap));
});


const syncWithRootState = () => {
  request({ url: `${ROOT_NODE_ADDRESS}/api/blocks` }, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      const rootChain = JSON.parse(body);

      console.log('replace chain on a sync with', rootChain);
      blockchain.replaceChain(rootChain);
    }
  });

  request({ url: `${ROOT_NODE_ADDRESS}/api/transaction-pool-map` }, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      const rootTransactionPoolMap = JSON.parse(body);

      console.log('replace transaction pool map on a sync with', rootTransactionPoolMap);
      transactionPool.setMap(rootTransactionPoolMap);
    }
  });
};

// syncWithRootState();

if (isDevelopment) {
  const walletFoo = new Wallet();
  const walletBar = new Wallet();

  const generateWalletTransaction = ({ wallet, recipient, amount }) => {
    const transaction = wallet.createTransaction({
      recipient, amount, chain: blockchain.chain
    });

    transactionPool.setTransaction(transaction);
  };

  const walletAction = () => generateWalletTransaction({
    wallet, recipient: walletFoo.publicKey, amount: 5
  });

  const walletFooAction = () => generateWalletTransaction({
    wallet: walletFoo, recipient: walletBar.publicKey, amount: 10
  });

  const walletBarAction = () => generateWalletTransaction({
    wallet: walletBar, recipient: wallet.publicKey, amount: 15
  });

  for (let i=0; i<5; i++) {
    if (i%3 === 0) {
      walletAction();
      walletFooAction();
    } else if (i%3 === 1) {
      walletAction();
      walletBarAction();
    } else {
      walletFooAction();
      walletBarAction();
    }

    transactionMiner.mineTransactions();
  }
}

let PEER_PORT;

if (process.env.GENERATE_PEER_PORT === 'true') {
  PEER_PORT = DEFAULT_PORT + Math.ceil(Math.random() * 1000);
}

const PORT = process.env.PORT || PEER_PORT || DEFAULT_PORT;
app.listen(PORT, () => {
  console.log(`listening at localhost:${PORT}`);

  if (PORT !== DEFAULT_PORT) {
    syncWithRootState();
  }
});
