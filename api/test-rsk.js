import { ethers } from 'ethers';

const RPC_URL = process.env.RSK_RPC_URL || 'https://public-node.testnet.rsk.co';

export default async function handler(req, res) {
  try {
    console.log('🔍 Testing RSK testnet connection');
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Test basic connectivity
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);
    
    // Test getting block 3141681
    const targetBlock = await provider.getBlock(3141681);
    console.log(`Target block exists: ${targetBlock ? 'Yes' : 'No'}`);
    
    if (targetBlock) {
      console.log(`Block timestamp: ${new Date(targetBlock.timestamp * 1000).toISOString()}`);
      console.log(`Transaction count: ${targetBlock.transactions.length}`);
    }
    
    // Test getting block with transactions
    const blockWithTx = await provider.getBlock(3141681, true);
    console.log(`Block with transactions: ${blockWithTx ? 'Yes' : 'No'}`);
    
    if (blockWithTx && blockWithTx.transactions) {
      console.log(`Transactions array length: ${blockWithTx.transactions.length}`);
      console.log(`First transaction type: ${typeof blockWithTx.transactions[0]}`);
      console.log(`First transaction: ${blockWithTx.transactions[0]}`);
    }
    
    return res.status(200).json({
      message: 'RSK testnet connection test',
      rpcUrl: RPC_URL,
      currentBlock: currentBlock,
      targetBlockExists: targetBlock ? true : false,
      targetBlockTimestamp: targetBlock ? new Date(targetBlock.timestamp * 1000).toISOString() : null,
      blockWithTransactions: blockWithTx ? true : false,
      transactionCount: blockWithTx && blockWithTx.transactions ? blockWithTx.transactions.length : 0,
      firstTransaction: blockWithTx && blockWithTx.transactions ? blockWithTx.transactions[0] : null
    });
    
  } catch (error) {
    console.error('❌ RSK test failed:', error);
    
    return res.status(500).json({
      error: 'RSK test failed',
      details: error.message
    });
  }
}