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
var wallet = new Wallet(alias= "", label= "main");
//create main wallet
const recoveryWallet = () => {
  db.find({}, function (err, doc) {
    console.log(`Recovery ${doc.length} wallets`)
    if (doc.length > 0) {

      doc.forEach(item => {
        newWallet = new Wallet(alias=item.alias, label=item.label, seeds=item.seeds, privateKey=item.privateKey, publicKey = item.publicKey, balance=item.balance, keyPair=item.keyPair);
        // if (item.label === 'main')
        //   wallet = newWallet
        wallets.push(newWallet)
      })
    } 
    // else {
    //   wallet = new Wallet(alias= "", label= "main")
    //   var values = {
    //     alias: wallet.alias,
    //     label: wallet.label,
    //     seeds: wallet.seeds,
    //     balance: wallet.balance,
    //     keyPair: JSON.stringify(wallet.keyPair),
    //     publicKey: wallet.publicKey,
    //   }
    //   db.insert([values], function(err, newDoc) {
    //     console.log(`Insert new ${wallet.publicKey} wallet`)
    //   });   
    //   wallets.push(wallet)
    // }
  });
  
}

// recoveryWallet()


// exit()
const pubsub = new PubSub({ blockchain, transactionPool, redisUrl: REDIS_URL });
// const pubsub = new PubSub({ blockchain, transactionPool, wallet }); // for PubNub
const transactionMiner = new TransactionMiner({ blockchain, transactionPool, wallet, pubsub });

app.use(bodyParser.json());

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
  var values = {
    alias: newWallet.alias,
    label: newWallet.label,
    seeds: newWallet.seeds,
    balance: newWallet.balance,
    keyPair: JSON.stringify(wallet.keyPair),
    publicKey: newWallet.publicKey,
  }
  db.insert([values], function(err, newDoc) {
    // console.log(newDoc)
});
  wallets.push(newWallet)
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
  if (wallets.find(o => o.publicKey === address))
    var isvalid = 1
  else
    var isvalid = 0

  res.json({
    'address': address,
    'isvalid': isvalid
  });
})

app.get('/api/listaddress', (req, res) => {
  var addresses = []
  wallets.forEach(address => {
    addresses.push(address.publicKey)
  })
  res.json(addresses);
});

app.get('/api/sendtoaddress/:recipient/:amount', (req, res) => {

  var { recipient, amount } = req.params;

  amount = parseFloat(amount)
  
  let transaction = transactionPool
    .existingTransaction({ inputAddress: wallet.publicKey });

  try {
    if (transaction) {
      transaction.update({ senderWallet: wallet, recipient, amount });
    } else {
      transaction = wallet.createTransaction({
        recipient,
        amount,
        chain: blockchain.chain
      });
    }
  } catch(error) {
    return res.status(400).json({ type: 'error', message: error.message });
  }

  transactionPool.setTransaction(transaction);

  pubsub.broadcastTransaction(transaction);

  res.json({ type: 'success', transaction });
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


app.get('/api/transaction-pool-map', (req, res) => {
  res.json(transactionPool.transactionMap);
});

app.get('/api/my-wallet', (req, res) => {
  const address = wallet.publicKey;

  res.json({
    address,
    balance: Wallet.calculateBalance({ chain: blockchain.chain, address })
  });
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
