import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';

// Contract addresses
const VAULT_MANAGER_ADDRESS = '0x0eccca821f078f394f2bb1f3d615ad73729a9892';
const ACTIVE_POOL_ADDRESS = '0x061c6A8EBb521fe74d3E07c9b835A236ac051e8F';
const DEFAULT_POOL_ADDRESS = '0x9BcA57F7D3712f46cd2D650a78f68e7928e866E2';
const TARGET_WALLET = '0xC6d15E60dBd01F694d6d955e205Df10C5fa9c417';

// Extended Vault Manager ABI
const VAULT_MANAGER_ABI = [
  'function Vaults(address) view returns (uint256 debt, uint256 coll, uint8 status, uint128 arrayIndex)',
  'function getEntireDebtAndColl(address _borrower) view returns (uint256 debt, uint256 coll, uint256 pendingLUSDDebtReward, uint256 pendingETHReward)',
  'function getVaultOwnersCount() view returns (uint256)',
  'function getVaultFromVaultOwnersArray(uint256 _index) view returns (address)',
  'function getCurrentICR(address _borrower, uint256 _price) view returns (uint256)',
  'function getNominalICR(address _borrower) view returns (uint256)',
  'function getVaultStatus(address _borrower) view returns (uint256)',
  'function hasPendingRewards(address _borrower) view returns (bool)',
  // Events
  'event VaultUpdated(address indexed _borrower, uint256 _debt, uint256 _coll, uint256 _stake, uint8 operation)',
  'event VaultLiquidated(address indexed _borrower, uint256 _debt, uint256 _coll, uint8 operation)'
];

// Pool ABI for balance checking
const POOL_ABI = [
  'function getETH() view returns (uint256)',
  'function getLUSDDebt() view returns (uint256)'
];

async function investigateVaultStatus() {
  console.log('🔍 INVESTIGATING VAULT STATUS DISCREPANCY');
  console.log('═══════════════════════════════════════════════');
  console.log(`🎯 Target wallet: ${TARGET_WALLET}`);
  console.log(`📊 Expected: 0.2771 BTC (27.4% of 1.0111 BTC)`);
  console.log(`✅ Actual: 0.634 BTC with status 99`);
  console.log('');

  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    const vaultManager = new ethers.Contract(VAULT_MANAGER_ADDRESS, VAULT_MANAGER_ABI, provider);
    const activePool = new ethers.Contract(ACTIVE_POOL_ADDRESS, POOL_ABI, provider);
    const defaultPool = new ethers.Contract(DEFAULT_POOL_ADDRESS, POOL_ABI, provider);
    
    // Step 1: Understand vault status codes
    console.log('📋 STEP 1: Vault Status Analysis');
    console.log('════════════════════════════════════');
    
    const vaultData = await vaultManager.Vaults(TARGET_WALLET);
    const debt = vaultData[0];
    const collateral = vaultData[1];
    const status = vaultData[2];
    const arrayIndex = vaultData[3];
    
    console.log(`Raw vault data:`);
    console.log(`  Debt: ${debt.toString()} wei (${ethers.formatEther(debt)} RBTC)`);
    console.log(`  Collateral: ${collateral.toString()} wei (${ethers.formatEther(collateral)} RBTC)`);
    console.log(`  Status: ${status}`);
    console.log(`  Array Index: ${arrayIndex}`);
    
    // Decode status
    const statusMap = {
      0: 'nonExistent',
      1: 'active', 
      2: 'closedByOwner',
      3: 'closedByLiquidation',
      4: 'closedByRedemption'
    };
    
    const statusName = statusMap[Number(status)] || `unknown (${status})`;
    console.log(`  Status meaning: ${statusName}`);
    
    if (status !== 1n) {
      console.log(`❌ Vault is NOT active - this explains why it's not in Active Pool`);
    }
    
    console.log('');
    
    // Step 2: Check current pool balances
    console.log('💰 STEP 2: Current Pool Balances');
    console.log('═══════════════════════════════════');
    
    const activePoolBalance = await provider.getBalance(ACTIVE_POOL_ADDRESS);
    const defaultPoolBalance = await provider.getBalance(DEFAULT_POOL_ADDRESS);
    
    console.log(`Active Pool balance: ${ethers.formatEther(activePoolBalance)} RBTC`);
    console.log(`Default Pool balance: ${ethers.formatEther(defaultPoolBalance)} RBTC`);
    console.log(`Total pool balance: ${ethers.formatEther(activePoolBalance + defaultPoolBalance)} RBTC`);
    
    // Check if the 0.634 RBTC is in the Default Pool
    if (status === 3n) { // closedByLiquidation
      console.log(`\n💡 HYPOTHESIS: Since vault status is closedByLiquidation, the 0.634 RBTC might be in Default Pool`);
      console.log(`Default Pool contains: ${ethers.formatEther(defaultPoolBalance)} RBTC`);
    }
    
    console.log('');
    
    // Step 3: Check all vault owners and their status
    console.log('👥 STEP 3: All Vault Owners Analysis');
    console.log('═══════════════════════════════════════');
    
    const vaultCount = await vaultManager.getVaultOwnersCount();
    console.log(`Total vault owners: ${vaultCount}`);
    
    let activeVaults = [];
    let inactiveVaults = [];
    let totalActiveCollateral = 0n;
    let totalInactiveCollateral = 0n;
    
    for (let i = 0; i < Number(vaultCount); i++) {
      try {
        const vaultOwner = await vaultManager.getVaultFromVaultOwnersArray(i);
        const ownerVaultData = await vaultManager.Vaults(vaultOwner);
        const ownerCollateral = ownerVaultData[1];
        const ownerStatus = ownerVaultData[2];
        const ownerDebt = ownerVaultData[0];
        
        const vaultInfo = {
          owner: vaultOwner,
          collateral: ethers.formatEther(ownerCollateral),
          debt: ethers.formatEther(ownerDebt),
          status: Number(ownerStatus),
          statusName: statusMap[Number(ownerStatus)] || `unknown (${ownerStatus})`,
          isTarget: vaultOwner.toLowerCase() === TARGET_WALLET.toLowerCase()
        };
        
        if (ownerStatus === 1n) { // Active
          activeVaults.push(vaultInfo);
          totalActiveCollateral += ownerCollateral;
        } else {
          inactiveVaults.push(vaultInfo);
          totalInactiveCollateral += ownerCollateral;
        }
        
      } catch (error) {
        console.log(`Error checking vault ${i}: ${error.message}`);
      }
    }
    
    console.log(`\n📊 VAULT BREAKDOWN:`);
    console.log(`Active vaults: ${activeVaults.length}`);
    console.log(`Inactive vaults: ${inactiveVaults.length}`);
    console.log(`Total active collateral: ${ethers.formatEther(totalActiveCollateral)} RBTC`);
    console.log(`Total inactive collateral: ${ethers.formatEther(totalInactiveCollateral)} RBTC`);
    
    console.log(`\n✅ ACTIVE VAULTS:`);
    activeVaults.forEach((vault, i) => {
      const percentage = totalActiveCollateral > 0n ? ((BigInt(vault.collateral.replace('.', '').padEnd(18, '0')) * 10000n) / (totalActiveCollateral / BigInt(10**14))).toString() / 100 : 0;
      console.log(`${i + 1}. ${vault.owner} ${vault.isTarget ? '👈 TARGET' : ''}`);
      console.log(`   Collateral: ${vault.collateral} RBTC (${percentage}%)`);
      console.log(`   Debt: ${vault.debt} RBTC`);
    });
    
    console.log(`\n❌ INACTIVE VAULTS:`);
    inactiveVaults.forEach((vault, i) => {
      console.log(`${i + 1}. ${vault.owner} ${vault.isTarget ? '👈 TARGET' : ''}`);
      console.log(`   Collateral: ${vault.collateral} RBTC`);
      console.log(`   Debt: ${vault.debt} RBTC`);
      console.log(`   Status: ${vault.statusName}`);
    });
    
    console.log('');
    
    // Step 4: Reconcile the discrepancy
    console.log('🔍 STEP 4: Discrepancy Analysis');
    console.log('═══════════════════════════════════');
    
    console.log(`Active Pool balance: ${ethers.formatEther(activePoolBalance)} RBTC`);
    console.log(`Sum of active vault collateral: ${ethers.formatEther(totalActiveCollateral)} RBTC`);
    console.log(`Difference: ${ethers.formatEther(activePoolBalance - totalActiveCollateral)} RBTC`);
    
    if (activePoolBalance !== totalActiveCollateral) {
      console.log(`\n⚠️ MISMATCH DETECTED!`);
      console.log(`The Active Pool balance doesn't match the sum of active vault collateral`);
      console.log(`This could indicate:`);
      console.log(`- Pool rewards or fees not accounted for`);
      console.log(`- Liquidation remnants`);
      console.log(`- System debt or redistribution effects`);
    }
    
    // Step 5: Find where the 1.0111 BTC figure comes from
    console.log('');
    console.log('🎯 STEP 5: Source of 1.0111 BTC Figure');
    console.log('═══════════════════════════════════════');
    
    const expectedTotal = ethers.parseEther("1.0111");
    const actualActive = activePoolBalance;
    
    console.log(`Expected total (from analysis): 1.0111 RBTC`);
    console.log(`Actual Active Pool: ${ethers.formatEther(actualActive)} RBTC`);
    console.log(`Match: ${Math.abs(Number(ethers.formatEther(actualActive - expectedTotal))) < 0.001 ? '✅' : '❌'}`);
    
    // Step 6: Explain the 0.2771 vs 0.634 discrepancy
    console.log('');
    console.log('💡 STEP 6: Explaining the Estimate vs Reality');
    console.log('════════════════════════════════════════════');
    
    const targetVault = inactiveVaults.find(v => v.isTarget);
    if (targetVault) {
      console.log(`\n🎯 TARGET VAULT ANALYSIS:`);
      console.log(`Original estimate: 0.2771 BTC (27.4% of 1.0111 BTC)`);
      console.log(`Actual collateral: ${targetVault.collateral} RBTC`);
      console.log(`Status: ${targetVault.statusName}`);
      console.log(`\n💭 EXPLANATION:`);
      console.log(`The 0.2771 BTC was an estimate based on the assumption that`);
      console.log(`this wallet was an ACTIVE vault contributing to the 1.0111 BTC Active Pool.`);
      console.log(`\nHowever, this vault is actually INACTIVE (${targetVault.statusName}),`);
      console.log(`so its 0.634 RBTC collateral is NOT part of the Active Pool.`);
      console.log(`\nThe estimate was methodologically flawed because it assumed`);
      console.log(`all 7 wallets were active contributors to the Active Pool.`);
    }
    
  } catch (error) {
    console.error('❌ Error investigating vault status:', error);
  }
}

investigateVaultStatus();