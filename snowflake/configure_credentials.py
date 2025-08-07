#!/usr/bin/env python3
"""
Interactive script to configure Snowflake and Supabase credentials
"""

import os
import getpass
from pathlib import Path

def get_credentials():
    """Interactively get credentials from user"""
    print("=" * 60)
    print("MP Indexer - Snowflake Configuration")
    print("=" * 60)
    print()
    
    print("📊 SNOWFLAKE CREDENTIALS")
    print("-" * 30)
    print("Find these in your Snowflake account")
    print()
    
    snowflake_user = input("Snowflake Username: ").strip()
    snowflake_password = getpass.getpass("Snowflake Password: ")
    
    print("\nSnowflake Account Identifier")
    print("Format: abc12345.us-east-1 (from your Snowflake URL)")
    snowflake_account = input("Account Identifier: ").strip()
    
    snowflake_warehouse = input("Warehouse (default: COMPUTE_WH): ").strip() or "COMPUTE_WH"
    snowflake_role = input("Role (default: ACCOUNTADMIN): ").strip() or "ACCOUNTADMIN"
    
    print()
    print("🔗 SUPABASE CREDENTIALS")
    print("-" * 30)
    print("Get these from your Vercel environment variables:")
    print("https://vercel.com/pjanusc85/mp-indexer/settings/environment-variables")
    print()
    
    supabase_url = input("Supabase URL (https://xxxxx.supabase.co): ").strip()
    supabase_key = input("Supabase Anon Key: ").strip()
    
    return {
        'SNOWFLAKE_USER': snowflake_user,
        'SNOWFLAKE_PASSWORD': snowflake_password,
        'SNOWFLAKE_ACCOUNT': snowflake_account,
        'SNOWFLAKE_WAREHOUSE': snowflake_warehouse,
        'SNOWFLAKE_ROLE': snowflake_role,
        'SUPABASE_URL': supabase_url,
        'SUPABASE_ANON_KEY': supabase_key
    }

def write_env_file(credentials):
    """Write credentials to .env.snowflake file"""
    env_path = Path('.env.snowflake')
    
    content = f"""# Snowflake Configuration
SNOWFLAKE_USER={credentials['SNOWFLAKE_USER']}
SNOWFLAKE_PASSWORD={credentials['SNOWFLAKE_PASSWORD']}
SNOWFLAKE_ACCOUNT={credentials['SNOWFLAKE_ACCOUNT']}
SNOWFLAKE_WAREHOUSE={credentials['SNOWFLAKE_WAREHOUSE']}
SNOWFLAKE_ROLE={credentials['SNOWFLAKE_ROLE']}

# Supabase Configuration
SUPABASE_URL={credentials['SUPABASE_URL']}
SUPABASE_ANON_KEY={credentials['SUPABASE_ANON_KEY']}
"""
    
    # Backup existing file if it exists
    if env_path.exists():
        backup_path = Path('.env.snowflake.backup')
        print(f"\n⚠️  Backing up existing config to {backup_path}")
        env_path.rename(backup_path)
    
    # Write new file
    env_path.write_text(content)
    print(f"\n✅ Configuration saved to {env_path}")
    
    # Set file permissions (Unix-like systems only)
    try:
        os.chmod(env_path, 0o600)
        print("✅ File permissions set to 600 (owner read/write only)")
    except:
        pass

def validate_credentials(credentials):
    """Basic validation of credentials"""
    errors = []
    
    if not credentials['SNOWFLAKE_USER']:
        errors.append("Snowflake username is required")
    
    if not credentials['SNOWFLAKE_PASSWORD']:
        errors.append("Snowflake password is required")
    
    if not credentials['SNOWFLAKE_ACCOUNT']:
        errors.append("Snowflake account identifier is required")
    elif '.' not in credentials['SNOWFLAKE_ACCOUNT']:
        print("⚠️  Warning: Account identifier usually contains a dot (e.g., abc12345.us-east-1)")
    
    if not credentials['SUPABASE_URL']:
        errors.append("Supabase URL is required")
    elif not credentials['SUPABASE_URL'].startswith('http'):
        errors.append("Supabase URL should start with http:// or https://")
    
    if not credentials['SUPABASE_ANON_KEY']:
        errors.append("Supabase anon key is required")
    
    return errors

def main():
    """Main configuration flow"""
    print("This script will help you configure your Snowflake and Supabase credentials")
    print("Your password will not be displayed as you type it")
    print()
    
    # Get credentials
    credentials = get_credentials()
    
    # Validate
    errors = validate_credentials(credentials)
    if errors:
        print("\n❌ Configuration errors:")
        for error in errors:
            print(f"   - {error}")
        print("\nPlease run the script again with correct information")
        return 1
    
    # Confirm before writing
    print("\n" + "=" * 60)
    print("REVIEW YOUR CONFIGURATION")
    print("=" * 60)
    print(f"Snowflake User: {credentials['SNOWFLAKE_USER']}")
    print(f"Snowflake Account: {credentials['SNOWFLAKE_ACCOUNT']}")
    print(f"Snowflake Warehouse: {credentials['SNOWFLAKE_WAREHOUSE']}")
    print(f"Snowflake Role: {credentials['SNOWFLAKE_ROLE']}")
    print(f"Supabase URL: {credentials['SUPABASE_URL']}")
    print(f"Supabase Key: {credentials['SUPABASE_ANON_KEY'][:20]}...")
    print()
    
    confirm = input("Save this configuration? (y/n): ").strip().lower()
    if confirm != 'y':
        print("Configuration cancelled")
        return 1
    
    # Write file
    write_env_file(credentials)
    
    print("\n" + "=" * 60)
    print("✅ CONFIGURATION COMPLETE")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Run: python3 snowflake/test_connection.py")
    print("2. Execute SQL scripts in Snowflake console")
    print("3. Run: python3 snowflake/sync_to_snowflake.py")
    
    return 0

if __name__ == "__main__":
    exit(main())