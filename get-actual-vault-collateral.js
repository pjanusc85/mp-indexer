import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Contract addresses
const VAULT_MANAGER_ADDRESS = '0x0eccca821f078f394f2bb1f3d615ad73729a9892';
const TARGET_WALLET = '0xC6d15E60dBd01F694d6d955e205Df10C5fa9c417';

// Vault Manager ABI - minimal interface for getting vault data
const VAULT_MANAGER_ABI = [
  'function Vaults(address) view returns (uint256 debt, uint256 coll, uint8 status, uint128 arrayIndex)',
  'function getCurrentICR(address _borrower, uint256 _price) view returns (uint256)',
  'function getEntireDebtAndColl(address _borrower) view returns (uint256 debt, uint256 coll, uint256 pendingLUSDDebtReward, uint256 pendingETHReward)',
  'function getVaultOwnersCount() view returns (uint256)',
  'function getVaultFromVaultOwnersArray(uint256 _index) view returns (address)'
];

async function getActualVaultCollateral() {
  console.log('🔍 GETTING ACTUAL VAULT COLLATERAL');
  console.log('═══════════════════════════════════════');
  console.log(`🎯 Target wallet: ${TARGET_WALLET}`);
  console.log(`🏦 Vault Manager: ${VAULT_MANAGER_ADDRESS}`);
  console.log('');

  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    const vaultManager = new ethers.Contract(VAULT_MANAGER_ADDRESS, VAULT_MANAGER_ABI, provider);
    
    // Method 1: Direct vault query
    console.log('📊 METHOD 1: Direct Vault Query');
    console.log('══════════════════════════════════');
    
    try {
      const vaultData = await vaultManager.Vaults(TARGET_WALLET);
      const debt = vaultData[0];
      const collateral = vaultData[1];
      const status = vaultData[2];
      const arrayIndex = vaultData[3];
      
      console.log(`Debt: ${ethers.formatEther(debt)} RBTC`);
      console.log(`Collateral: ${ethers.formatEther(collateral)} RBTC`);
      console.log(`Status: ${status} (0=nonExistent, 1=active, 2=closedByOwner, 3=closedByLiquidation, 4=closedByRedemption)`);
      console.log(`Array Index: ${arrayIndex}`);
      
      if (status === 1n) {
        console.log(`✅ CONFIRMED COLLATERAL: ${ethers.formatEther(collateral)} RBTC`);
      } else {
        console.log(`❌ Vault is not active (status: ${status})`);
      }
    } catch (error) {
      console.log(`❌ Direct query failed: ${error.message}`);
    }
    
    console.log('');
    
    // Method 2: Get entire debt and collateral (includes pending rewards)
    console.log('📊 METHOD 2: Entire Debt and Collateral Query');
    console.log('════════════════════════════════════════════');
    
    try {
      const entireData = await vaultManager.getEntireDebtAndColl(TARGET_WALLET);
      const totalDebt = entireData[0];
      const totalColl = entireData[1];
      const pendingDebtReward = entireData[2];
      const pendingCollReward = entireData[3];
      
      console.log(`Total Debt: ${ethers.formatEther(totalDebt)} RBTC`);
      console.log(`Total Collateral: ${ethers.formatEther(totalColl)} RBTC`);
      console.log(`Pending Debt Reward: ${ethers.formatEther(pendingDebtReward)} RBTC`);
      console.log(`Pending Coll Reward: ${ethers.formatEther(pendingCollReward)} RBTC`);
      
      if (totalColl > 0n) {
        console.log(`✅ CONFIRMED TOTAL COLLATERAL: ${ethers.formatEther(totalColl)} RBTC`);
      }
    } catch (error) {
      console.log(`❌ Entire debt/coll query failed: ${error.message}`);
    }
    
    console.log('');
    
    // Method 3: Check vault events from database
    console.log('📊 METHOD 3: Vault Events Analysis');
    console.log('══════════════════════════════════════');
    
    try {
      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      };
      
      // Query vault events for this specific wallet
      const vaultEventsUrl = `${SUPABASE_URL}/rest/v1/vault_events?select=*&vault_id=eq.${TARGET_WALLET.toLowerCase()}&order=block_number.desc&limit=50`;
      const response = await fetch(vaultEventsUrl, { headers });
      
      if (response.ok) {
        const events = await response.json();
        console.log(`Found ${events.length} vault events for this wallet`);
        
        if (events.length > 0) {
          console.log('Recent events:');
          events.slice(0, 5).forEach((event, i) => {
            console.log(`${i + 1}. Block ${event.block_number}: ${event.event_type}`);
            console.log(`   Transaction: ${event.transaction_hash}`);
            console.log(`   Timestamp: ${event.timestamp}`);
          });
        } else {
          console.log('❌ No vault events found for this wallet in database');
        }
      } else {
        console.log(`❌ Failed to query vault events: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Database query failed: ${error.message}`);
    }
    
    console.log('');
    
    // Method 4: Check all active vaults to verify total
    console.log('📊 METHOD 4: Active Vaults Summary');
    console.log('══════════════════════════════════════');
    
    try {
      const vaultCount = await vaultManager.getVaultOwnersCount();
      console.log(`Total vault owners: ${vaultCount}`);
      
      let totalActiveCollateral = 0n;
      let activeVaults = [];
      
      // Check first 20 vaults (to avoid timeout)
      const maxCheck = Math.min(Number(vaultCount), 20);
      console.log(`Checking first ${maxCheck} vaults...`);
      
      for (let i = 0; i < maxCheck; i++) {
        try {
          const vaultOwner = await vaultManager.getVaultFromVaultOwnersArray(i);
          const vaultData = await vaultManager.Vaults(vaultOwner);
          const collateral = vaultData[1];
          const status = vaultData[2];
          
          if (status === 1n && collateral > 0n) { // Active vault with collateral
            totalActiveCollateral += collateral;
            activeVaults.push({
              owner: vaultOwner,
              collateral: ethers.formatEther(collateral),
              isTarget: vaultOwner.toLowerCase() === TARGET_WALLET.toLowerCase()
            });
          }
        } catch (error) {
          console.log(`Error checking vault ${i}: ${error.message}`);
        }
      }
      
      console.log(`\nActive vaults found: ${activeVaults.length}`);
      console.log(`Total active collateral: ${ethers.formatEther(totalActiveCollateral)} RBTC`);
      
      // Show target wallet in the list
      const targetVault = activeVaults.find(v => v.isTarget);
      if (targetVault) {
        console.log(`\n🎯 TARGET WALLET FOUND:`);
        console.log(`   Address: ${targetVault.owner}`);
        console.log(`   Collateral: ${targetVault.collateral} RBTC`);
        console.log(`   Percentage: ${((parseFloat(targetVault.collateral) / parseFloat(ethers.formatEther(totalActiveCollateral))) * 100).toFixed(2)}%`);
      } else {
        console.log(`\n❌ Target wallet not found in active vaults`);
      }
      
    } catch (error) {
      console.log(`❌ Active vaults check failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error getting actual vault collateral:', error);
  }
}

getActualVaultCollateral();