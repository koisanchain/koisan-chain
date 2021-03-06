const MINE_RATE = 1000;
const INITIAL_DIFFICULTY = 3;

const GENESIS_DATA = {
  timestamp: 0,
  lastHash: 'KETIADAAN',
  hash: 'ALPHA',
  difficulty: INITIAL_DIFFICULTY,
  nonce: 0,
  data: []
};

const STARTING_BALANCE = 0;

const REWARD_INPUT = { address: '*authorized-reward*' };

const MINING_REWARD = 240;

module.exports = {
  GENESIS_DATA,
  MINE_RATE,
  STARTING_BALANCE,
  REWARD_INPUT,
  MINING_REWARD
};
