#!/usr/bin/env node

import { ethers } from 'ethers';

const RPC_URL = 'https://public-node.testnet.rsk.co';

async function getLatestBlock() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Get current block number
    const blockNumber = await provider.getBlockNumber();
    console.log(`Latest block number: ${blockNumber.toLocaleString()}`);
    
    // Get block details
    const block = await provider.getBlock(blockNumber);
    if (block) {
      console.log(`Block timestamp: ${new Date(block.timestamp * 1000).toISOString()}`);
      console.log(`Block hash: ${block.hash}`);
      console.log(`Transaction count: ${block.transactions.length}`);
    }
    
    return blockNumber;
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getLatestBlock();