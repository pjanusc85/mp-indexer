#!/usr/bin/env node

import { config } from 'dotenv';
import { ethers } from 'ethers';

// Load environment variables
config({ path: '.env.local' });

const RPC_URL = process.env.RSK_RPC_URL || 'https://www.intrinsic.network';

const CONTRACTS = {
  vaultManager: '0x54F2712Fd31Fc81A47D014727C12F26ba24Feec2',
  sortedVaults: '0xDBA59981bda70CCBb5458e907f5A0729F1d24a05'
};

console.log('🔍 Checking Vault Counts on RSK Testnet\n');

async function checkVaultCounts() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    console.log('📡 Connecting to RSK...');
    const currentBlock = await provider.getBlockNumber();
    console.log(`✅ Connected. Current block: ${currentBlock}\n`);
    
    // Common Money Protocol / Liquity view functions to try
    const commonFunctions = [
      'getTotalCollateral()',
      'getTotalDebt()', 
      'getVaultOwnersCount()',
      'getTroveOwnersCount()', // Liquity uses "Trove" instead of "Vault"
      'getSize()',
      'getCollateralAmount()',
      'getCurrentDebt()',
      'getEntireSystemDebt()',
      'getEntireSystemCollateral()',
      'getListSize()', // SortedVaults function
      'isEmpty()', // SortedVaults function
      'getFirst()', // SortedVaults function
      'getLast()' // SortedVaults function
    ];
    
    for (const [contractName, contractAddress] of Object.entries(CONTRACTS)) {
      console.log(`🔍 ${contractName.toUpperCase()}: ${contractAddress}`);
      
      // First, check if contract has code
      const code = await provider.getCode(contractAddress);
      if (code === '0x') {
        console.log('   ❌ No contract code found at this address\n');
        continue;
      }
      console.log('   ✅ Contract has code');
      
      // Try common view functions
      for (const funcSig of commonFunctions) {
        try {
          const iface = new ethers.Interface([`function ${funcSig} view returns (uint256)`]);
          const data = iface.encodeFunctionData(funcSig.split('(')[0], []);
          
          const result = await provider.call({
            to: contractAddress,
            data: data
          });
          
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], result);
          const value = decoded[0].toString();
          
          console.log(`   📊 ${funcSig}: ${value}`);
          
          // Highlight interesting values
          if (BigInt(value) > 0n) {
            console.log(`       🎉 Found non-zero value!`);
          }
          
        } catch (error) {
          // Function doesn't exist or failed - this is normal
          continue;
        }
      }
      
      // Try to get vault count with different function names
      const vaultCountFunctions = [
        'getVaultOwnersCount()',
        'getTroveOwnersCount()',
        'getNumberOfTroves()',
        'totalVaults()',
        'vaultCount()'
      ];
      
      console.log('   🔍 Trying vault count functions...');
      let foundVaultCount = false;
      
      for (const funcSig of vaultCountFunctions) {
        try {
          const iface = new ethers.Interface([`function ${funcSig} view returns (uint256)`]);
          const data = iface.encodeFunctionData(funcSig.split('(')[0], []);
          
          const result = await provider.call({
            to: contractAddress,
            data: data
          });
          
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], result);
          const vaultCount = decoded[0].toString();
          
          console.log(`   🎯 ${funcSig}: ${vaultCount} vaults`);
          foundVaultCount = true;
          
          if (BigInt(vaultCount) > 0n) {
            console.log(`       🎉 Found ${vaultCount} vaults!`);
          } else {
            console.log(`       ℹ️  Zero vaults (explains why no events)`);
          }
          
        } catch (error) {
          continue;
        }
      }
      
      if (!foundVaultCount) {
        console.log('   ❓ Could not determine vault count');
      }
      
      console.log('');
    }
    
    console.log('📋 Summary:');
    console.log('   • If vault counts are 0, that explains why vault_events is empty');
    console.log('   • If vault counts are >0, there might be events in older blocks');
    console.log('   • Contract functions help us understand the protocol state');
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

checkVaultCounts().catch(console.error);