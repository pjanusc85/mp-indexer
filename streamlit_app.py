import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Page config
st.set_page_config(
    page_title="Money Protocol Analytics",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize Supabase connection
@st.cache_data(ttl=60)
def get_supabase_config():
    url = os.getenv("SUPABASE_URL") or st.secrets.get("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY") or st.secrets.get("SUPABASE_ANON_KEY")
    
    if not url or not key:
        st.error("Missing Supabase credentials. Please add SUPABASE_URL and SUPABASE_ANON_KEY to Streamlit Secrets")
        st.stop()
    
    return url, key

SUPABASE_URL, SUPABASE_KEY = get_supabase_config()

# Custom CSS
st.markdown("""
<style>
    .main {
        padding-top: 2rem;
    }
    .metric-card {
        background-color: #f8fafc;
        padding: 1rem;
        border-radius: 0.5rem;
        border: 1px solid #e2e8f0;
        text-align: center;
        margin: 0.5rem 0;
    }
    .metric-value {
        color: #1e293b;
        font-size: 1.875rem;
        font-weight: 700;
    }
    .metric-label {
        color: #64748b;
        font-size: 0.875rem;
        font-weight: 500;
    }
</style>
""", unsafe_allow_html=True)

# Title
st.title("🏦 Money Protocol Analytics Dashboard")
st.markdown("Real-time analytics for Money Protocol on RSK testnet")

# ===========================================
# SIDEBAR NAVIGATION
# ===========================================

st.sidebar.markdown("## 📊 Analytics Navigation")

# Main navigation
analytics_section = st.sidebar.selectbox(
    "Select Analytics Section",
    [
        "🏠 Overview",
        "🏦 Vault Analytics", 
        "💰 TVL Analytics",
        "🪙 BPD Analytics", 
        "📈 Gains from Staking Analytics",
        "🔄 Redemption Gains from Staking Analytics",
        "🎯 MP Staking Analytics"
    ]
)

# Filters
st.sidebar.markdown("## ⚙️ Filters")

# Time range selector
time_range = st.sidebar.selectbox(
    "Time Range",
    ["Last 24 Hours", "Last 7 Days", "Last 30 Days", "Last 90 Days", "All Time"],
    index=4  # Default to "All Time"
)

# Calculate date range
end_date = datetime.now()
if time_range == "Last 24 Hours":
    start_date = end_date - timedelta(days=1)
elif time_range == "Last 7 Days":
    start_date = end_date - timedelta(days=7)
elif time_range == "Last 30 Days":
    start_date = end_date - timedelta(days=30)
elif time_range == "Last 90 Days":
    start_date = end_date - timedelta(days=90)
else:
    start_date = datetime(2023, 1, 1)  # All time

# Custom date range
use_custom = st.sidebar.checkbox("Use Custom Date Range")
if use_custom:
    col1, col2 = st.sidebar.columns(2)
    with col1:
        start_date = st.date_input("Start Date", value=start_date)
    with col2:
        end_date = st.date_input("End Date", value=end_date)
    start_date = datetime.combine(start_date, datetime.min.time())
    end_date = datetime.combine(end_date, datetime.max.time())

# Event type filter (for vault analytics)
if analytics_section in ["🏠 Overview", "🏦 Vault Analytics"]:
    event_types = st.sidebar.multiselect(
        "Event Types",
        ["VaultUpdated", "VaultLiquidated"],
        default=["VaultUpdated", "VaultLiquidated"]
    )
else:
    event_types = ["VaultUpdated", "VaultLiquidated"]

# ===========================================
# DATA FETCHING FUNCTIONS
# ===========================================

@st.cache_data(ttl=60)
def fetch_vault_events(start_date, end_date, event_types):
    """Fetch vault events from Supabase"""
    try:
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
        }
        
        # Build URL
        url = f'{SUPABASE_URL}/rest/v1/vault_events?select=*'
        if start_date.year != 2023:  # Not "All Time"
            url += f'&timestamp=gte.{start_date.isoformat()}'
            url += f'&timestamp=lte.{end_date.isoformat()}'
        
        # Add event type filter
        if event_types and len(event_types) < 2:
            event_filter = '|'.join(event_types)
            url += f'&event_type=in.({event_filter})'
        
        url += '&order=timestamp.desc'
        
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                df = pd.DataFrame(data)
                df['timestamp'] = pd.to_datetime(df['timestamp'], format='ISO8601')
                return df
            else:
                return pd.DataFrame()
        else:
            st.sidebar.error(f"Error fetching vault events: {response.status_code}")
            return pd.DataFrame()
            
    except Exception as e:
        st.sidebar.error(f"Error fetching vault events: {str(e)}")
        return pd.DataFrame()

@st.cache_data(ttl=60)
def fetch_tvl_data():
    """Fetch TVL data from Supabase"""
    try:
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
        }
        
        url = f'{SUPABASE_URL}/rest/v1/tvl_snapshots?select=*&order=timestamp.desc&limit=100'
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                df = pd.DataFrame(data)
                df['timestamp'] = pd.to_datetime(df['timestamp'], format='ISO8601')
                return df
            else:
                return pd.DataFrame()
        else:
            return pd.DataFrame()
    except Exception as e:
        st.sidebar.error(f"Error fetching TVL data: {str(e)}")
        return pd.DataFrame()

@st.cache_data(ttl=60)
def fetch_bpd_supply_data():
    """Fetch BPD supply data from Supabase"""
    try:
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
        }
        
        url = f'{SUPABASE_URL}/rest/v1/bpd_supply_snapshots?select=*&order=timestamp.desc&limit=100'
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                df = pd.DataFrame(data)
                df['timestamp'] = pd.to_datetime(df['timestamp'], format='ISO8601')
                return df
            else:
                return pd.DataFrame()
        else:
            return pd.DataFrame()
    except Exception as e:
        st.sidebar.error(f"Error fetching BPD supply data: {str(e)}")
        return pd.DataFrame()

@st.cache_data(ttl=60)
def fetch_staking_gains_data():
    """Fetch staking gains data from Supabase"""
    try:
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
        }
        
        url = f'{SUPABASE_URL}/rest/v1/staking_gains_daily?select=*&order=day.desc'
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                df = pd.DataFrame(data)
                df['day'] = pd.to_datetime(df['day'], format='ISO8601')
                return df
            else:
                return pd.DataFrame()
        else:
            return pd.DataFrame()
    except Exception as e:
        st.sidebar.error(f"Error fetching staking gains data: {str(e)}")
        return pd.DataFrame()

@st.cache_data(ttl=60)
def fetch_redemption_gains_data():
    """Fetch redemption gains data from Supabase"""
    try:
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
        }
        
        url = f'{SUPABASE_URL}/rest/v1/redemption_gains_daily?select=*&order=day.desc'
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                df = pd.DataFrame(data)
                df['day'] = pd.to_datetime(df['day'], format='ISO8601')
                return df
            else:
                return pd.DataFrame()
        else:
            return pd.DataFrame()
    except Exception as e:
        st.sidebar.error(f"Error fetching redemption gains data: {str(e)}")
        return pd.DataFrame()

@st.cache_data(ttl=60)
def fetch_mp_staking_data():
    """Fetch MP staking data from Supabase"""
    try:
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
        }
        
        url = f'{SUPABASE_URL}/rest/v1/mp_staking_hourly?select=*&order=hour.desc&limit=168'  # Last 7 days hourly
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                df = pd.DataFrame(data)
                df['hour'] = pd.to_datetime(df['hour'], format='ISO8601')
                df = df.fillna(0)
                # Convert to numeric
                df['total_mp_staked'] = pd.to_numeric(df['total_mp_staked'], errors='coerce')
                df['total_mp_claimed'] = pd.to_numeric(df['total_mp_claimed'], errors='coerce')
                df['mp_claimed_in_hour'] = pd.to_numeric(df['mp_claimed_in_hour'], errors='coerce')
                return df
            else:
                return pd.DataFrame()
        else:
            return pd.DataFrame()
    except Exception as e:
        st.sidebar.error(f"Error fetching MP staking data: {str(e)}")
        return pd.DataFrame()

@st.cache_data(ttl=60)
def fetch_mp_staking_wallets():
    """Fetch individual MP staking wallet breakdown from API"""
    try:
        url = 'https://mp-indexer.vercel.app/api/mp-staking-wallets'
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('wallets'):
                wallets_df = pd.DataFrame(data['wallets'])
                summary = data.get('summary', {})
                return wallets_df, summary
            else:
                return pd.DataFrame(), {}
        else:
            return pd.DataFrame(), {}
    except Exception as e:
        st.sidebar.error(f"Error fetching MP staking wallets: {str(e)}")
        return pd.DataFrame(), {}

@st.cache_data(ttl=60)
def fetch_balance_tracking_data():
    """Fetch balance tracking data from Supabase (Dune Analytics style)"""
    try:
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
        }
        
        # Fetch hourly balance data
        url = f'{SUPABASE_URL}/rest/v1/pool_balance_hourly?select=*&order=hour.desc&limit=168'  # Last 7 days
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                df = pd.DataFrame(data)
                df['hour'] = pd.to_datetime(df['hour'], format='ISO8601')
                df = df.fillna(0)
                # Convert to numeric
                numeric_columns = ['hourly_change_btc', 'ending_balance_btc', 'transaction_count', 'btc_price_usd', 'ending_balance_usd']
                for col in numeric_columns:
                    if col in df.columns:
                        df[col] = pd.to_numeric(df[col], errors='coerce')
                return df
            else:
                return pd.DataFrame()
        else:
            return pd.DataFrame()
    except Exception as e:
        st.sidebar.error(f"Error fetching balance tracking data: {str(e)}")
        return pd.DataFrame()

@st.cache_data(ttl=60)
def fetch_current_pool_balances():
    """Fetch current pool balances from Supabase view"""
    try:
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
        }
        
        url = f'{SUPABASE_URL}/rest/v1/pool_balances_current?select=*'
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                df = pd.DataFrame(data)
                df['last_updated'] = pd.to_datetime(df['last_updated'], format='ISO8601')
                # Convert to numeric
                numeric_columns = ['current_balance_btc', 'current_balance_usd', 'last_btc_price']
                for col in numeric_columns:
                    if col in df.columns:
                        df[col] = pd.to_numeric(df[col], errors='coerce')
                return df
            else:
                return pd.DataFrame()
        else:
            return pd.DataFrame()
    except Exception as e:
        st.sidebar.error(f"Error fetching current pool balances: {str(e)}")
        return pd.DataFrame()

def calculate_summary_stats(df):
    """Calculate summary statistics from vault events"""
    if df.empty:
        return {
            'total_events': 0,
            'unique_vaults': 0,
            'total_updates': 0,
            'total_liquidations': 0,
            'latest_block': 0
        }
    
    return {
        'total_events': len(df),
        'unique_vaults': df['vault_id'].nunique() if 'vault_id' in df else 0,
        'total_updates': len(df[df['event_type'] == 'VaultUpdated']) if 'event_type' in df else 0,
        'total_liquidations': len(df[df['event_type'] == 'VaultLiquidated']) if 'event_type' in df else 0,
        'latest_block': df['block_number'].max() if 'block_number' in df else 0
    }

# ===========================================
# CONTENT SECTIONS
# ===========================================

def render_overview():
    """Render the overview section"""
    st.markdown("## Welcome to Money Protocol Analytics")
    st.markdown("Select a specific analytics section from the sidebar to dive deeper into the data.")
    
    # Fetch overview data
    df = fetch_vault_events(start_date, end_date, event_types)
    stats = calculate_summary_stats(df)
    
    # Connection status
    col1, col2, col3 = st.columns([2, 1, 1])
    with col1:
        if not df.empty:
            st.success(f"✅ Connected to Supabase - Found {len(df)} events")
        else:
            st.warning("⚠️ No vault events found for selected filters")
    with col2:
        st.info(f"📅 {time_range}")
    with col3:
        st.info(f"🔗 {len(event_types)} event types")
    
    # Key metrics
    st.markdown("## 📈 Key Metrics Summary")
    col1, col2, col3, col4, col5 = st.columns(5)
    
    metrics = [
        ("Total Events", stats['total_events'], "#1e293b"),
        ("Unique Vaults", stats['unique_vaults'], "#1e293b"),
        ("Vault Updates", stats['total_updates'], "#059669"),
        ("Liquidations", stats['total_liquidations'], "#dc2626"),
        ("Latest Block", stats['latest_block'], "#1e293b")
    ]
    
    for i, (label, value, color) in enumerate(metrics):
        with [col1, col2, col3, col4, col5][i]:
            st.markdown(f"""
            <div class="metric-card">
                <div class="metric-label">{label}</div>
                <div class="metric-value" style="color: {color};">{value:,}</div>
            </div>
            """, unsafe_allow_html=True)
    
    # Quick charts
    if not df.empty:
        st.markdown("## 📊 Quick Overview")
        col1, col2 = st.columns(2)
        
        with col1:
            # Event type distribution
            event_counts = df['event_type'].value_counts()
            fig = px.pie(
                values=event_counts.values,
                names=event_counts.index,
                title="Event Type Distribution",
                color_discrete_map={'VaultUpdated': '#3b82f6', 'VaultLiquidated': '#ef4444'}
            )
            fig.update_traces(textposition='inside', textinfo='percent+label')
            st.plotly_chart(fig, use_container_width=True)
        
        with col2:
            # Recent activity trend
            df['date'] = df['timestamp'].dt.date
            daily_events = df.groupby('date').size().reset_index(name='count')
            fig = px.line(
                daily_events.tail(14),
                x='date',
                y='count',
                title="Daily Activity (Last 14 Days)",
                labels={'date': 'Date', 'count': 'Event Count'},
                color_discrete_sequence=['#10b981']
            )
            st.plotly_chart(fig, use_container_width=True)

def render_vault_analytics():
    """Render vault analytics section"""
    df = fetch_vault_events(start_date, end_date, event_types)
    stats = calculate_summary_stats(df)
    
    if df.empty:
        st.warning("No vault events found for the selected time range and filters.")
        return
    
    # Convert timestamp and add derived columns
    df['date'] = df['timestamp'].dt.date
    df['hour'] = df['timestamp'].dt.hour
    
    # Key metrics
    st.markdown("## 📊 Vault Metrics")
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("Total Events", f"{stats['total_events']:,}")
    with col2:
        st.metric("Unique Vaults", f"{stats['unique_vaults']:,}")
    with col3:
        st.metric("Updates", f"{stats['total_updates']:,}")
    with col4:
        st.metric("Liquidations", f"{stats['total_liquidations']:,}")
    
    # Create tabs for different views
    tab1, tab2, tab3, tab4 = st.tabs(["📈 Trends", "🏆 Top Vaults", "🔍 Event Details", "📋 Raw Data"])
    
    with tab1:
        col1, col2 = st.columns(2)
        
        with col1:
            # Daily events trend
            daily_events = df.groupby(['date', 'event_type']).size().reset_index(name='count')
            fig = px.line(
                daily_events,
                x='date',
                y='count',
                color='event_type',
                title="Daily Event Trends",
                labels={'date': 'Date', 'count': 'Event Count'},
                color_discrete_map={'VaultUpdated': '#3b82f6', 'VaultLiquidated': '#ef4444'}
            )
            fig.update_layout(hovermode='x unified')
            st.plotly_chart(fig, use_container_width=True)
        
        with col2:
            # Hourly distribution
            hourly_data = df.groupby('hour').size().reset_index(name='count')
            fig = px.bar(
                hourly_data,
                x='hour',
                y='count',
                title="Activity by Hour of Day",
                labels={'hour': 'Hour of Day', 'count': 'Event Count'},
                color_discrete_sequence=['#3b82f6']
            )
            st.plotly_chart(fig, use_container_width=True)
        
        # Cumulative events
        st.markdown("### Cumulative Events Over Time")
        df_sorted = df.sort_values('timestamp')
        df_sorted['cumulative'] = range(1, len(df_sorted) + 1)
        fig = px.area(
            df_sorted,
            x='timestamp',
            y='cumulative',
            title="Cumulative Events",
            labels={'timestamp': 'Time', 'cumulative': 'Total Events'},
            color_discrete_sequence=['#10b981']
        )
        st.plotly_chart(fig, use_container_width=True)
    
    with tab2:
        # Top vaults analysis
        if 'vault_id' in df.columns:
            vault_activity = df[df['vault_id'].notna()].groupby('vault_id').agg({
                'event_type': 'count',
                'timestamp': ['min', 'max']
            }).reset_index()
            vault_activity.columns = ['vault_id', 'event_count', 'first_seen', 'last_seen']
            vault_activity = vault_activity.sort_values('event_count', ascending=False).head(10)
            
            st.markdown("### Most Active Vaults")
            st.dataframe(vault_activity, use_container_width=True)
            
            # Bar chart
            fig = px.bar(
                vault_activity,
                x='vault_id',
                y='event_count',
                title="Top 10 Most Active Vaults",
                labels={'vault_id': 'Vault ID', 'event_count': 'Event Count'},
                color_discrete_sequence=['#3b82f6']
            )
            fig.update_layout(xaxis_tickangle=45)
            st.plotly_chart(fig, use_container_width=True)
    
    with tab3:
        # Recent events
        st.markdown("### Recent Events")
        
        col1, col2 = st.columns([3, 1])
        with col1:
            search_vault = st.text_input("Search by Vault ID", placeholder="Enter vault ID...")
        with col2:
            limit = st.number_input("Show events", min_value=10, max_value=100, value=20, step=10)
        
        recent_df = df.sort_values('timestamp', ascending=False)
        
        if search_vault:
            recent_df = recent_df[recent_df['vault_id'].str.contains(search_vault, case=False, na=False)]
        
        recent_df = recent_df.head(limit)
        
        for _, event in recent_df.iterrows():
            event_color = "#3b82f6" if event['event_type'] == 'VaultUpdated' else "#ef4444"
            st.markdown(f"""
            <div style="border-left: 3px solid {event_color}; padding: 10px; margin: 10px 0; background-color: #f9fafb;">
                <strong>{event['event_type']}</strong> | Block: {event['block_number']} | {event['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}
                <br>Vault: <code>{event['vault_id']}</code>
                <br>Tx: <code>{event['transaction_hash']}</code>
            </div>
            """, unsafe_allow_html=True)
    
    with tab4:
        # Raw data
        st.markdown("### Raw Event Data")
        st.info(f"Showing {len(df)} events")
        
        csv = df.to_csv(index=False)
        st.download_button(
            label="📥 Download CSV",
            data=csv,
            file_name=f"vault_events_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv"
        )
        
        st.dataframe(df.sort_values('timestamp', ascending=False), use_container_width=True)

def render_tvl_analytics():
    """Render TVL analytics section"""
    tvl_df = fetch_tvl_data()
    balance_tracking_df = fetch_balance_tracking_data()
    current_balances_df = fetch_current_pool_balances()
    
    if tvl_df.empty:
        st.warning("No TVL data available yet. The indexer will collect this data during regular operations.")
        return
    
    # Get latest TVL values
    latest_tvl = tvl_df.iloc[0]  # Most recent (desc order)
    
    st.markdown("## 💰 Total Value Locked (TVL)")
    
    # TVL Metrics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            "Current TVL (BTC)",
            f"{latest_tvl['total_btc']:.4f}",
            help="Total BTC locked in the protocol"
        )
    
    with col2:
        st.metric(
            "Active Pool",
            f"{latest_tvl['active_pool_btc']:.4f}",
            help="BTC in the Active Pool"
        )
    
    with col3:
        st.metric(
            "Default Pool", 
            f"{latest_tvl['default_pool_btc']:.4f}",
            help="BTC in the Default Pool"
        )
    
    with col4:
        # Calculate change if we have multiple data points
        if len(tvl_df) > 1:
            prev_tvl = tvl_df.iloc[1]['total_btc']
            tvl_change = latest_tvl['total_btc'] - prev_tvl
            st.metric(
                "Recent Change",
                f"{tvl_change:+.4f}",
                help="Change since last snapshot"
            )
        else:
            st.metric("Recent Change", "N/A")
    
    # Create tabs for different TVL views
    tab1, tab2, tab3 = st.tabs(["📈 TVL Trends", "📊 Pool Distribution", "🔍 Balance Tracking (Dune Style)"])
    
    with tab1:
        # TVL Chart
        st.markdown("### TVL Over Time")
        fig = px.line(
            tvl_df.sort_values('timestamp'),
            x='timestamp',
            y='total_btc',
            title='Total Value Locked Over Time',
            labels={'timestamp': 'Time', 'total_btc': 'BTC Locked'}
        )
        fig.update_layout(hovermode='x unified')
        st.plotly_chart(fig, use_container_width=True)
        
        # Pool trends over time
        st.markdown("### Pool Trends Over Time")
        fig = go.Figure()
        
        fig.add_trace(go.Scatter(
            x=tvl_df['timestamp'],
            y=tvl_df['active_pool_btc'],
            mode='lines',
            name='Active Pool',
            line=dict(color='#3b82f6')
        ))
        
        fig.add_trace(go.Scatter(
            x=tvl_df['timestamp'],
            y=tvl_df['default_pool_btc'],
            mode='lines',
            name='Default Pool',
            line=dict(color='#ef4444')
        ))
        
        fig.update_layout(
            title='Individual Pool Balances Over Time',
            xaxis_title='Time',
            yaxis_title='BTC Amount',
            hovermode='x unified'
        )
        
        st.plotly_chart(fig, use_container_width=True)
    
    with tab2:
        # Pool breakdown
        col1, col2 = st.columns(2)
        
        with col1:
            # Current pool distribution pie chart
            pools = ['Active Pool', 'Default Pool']
            values = [latest_tvl['active_pool_btc'], latest_tvl['default_pool_btc']]
            
            fig = px.pie(
                values=values,
                names=pools,
                title='Current Pool Distribution'
            )
            st.plotly_chart(fig, use_container_width=True)
        
        with col2:
            # Current balances table (if available from balance tracking)
            if not current_balances_df.empty:
                st.markdown("### Current Pool Balances")
                
                # Format the data for display
                display_df = current_balances_df.copy()
                display_df = display_df.rename(columns={
                    'pool_type': 'Pool Type',
                    'current_balance_btc': 'Balance (BTC)',
                    'current_balance_usd': 'Balance (USD)',
                    'last_updated': 'Last Updated'
                })
                
                # Format numeric columns
                if 'Balance (BTC)' in display_df.columns:
                    display_df['Balance (BTC)'] = display_df['Balance (BTC)'].round(8)
                if 'Balance (USD)' in display_df.columns:
                    display_df['Balance (USD)'] = display_df['Balance (USD)'].round(2)
                
                st.dataframe(
                    display_df[['Pool Type', 'Balance (BTC)', 'Balance (USD)', 'Last Updated']],
                    use_container_width=True,
                    hide_index=True
                )
            else:
                st.info("Balance tracking data will appear here once the enhanced indexer runs")
    
    with tab3:
        # Balance tracking data (Dune Analytics style)
        st.markdown("### 📊 Balance Tracking Analytics (Dune Style)")
        st.markdown("Detailed hourly balance changes and trends equivalent to Dune Analytics queries")
        
        if not balance_tracking_df.empty:
            # Balance tracking metrics
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                total_hours = len(balance_tracking_df)
                st.metric("Hours Tracked", f"{total_hours:,}")
            
            with col2:
                avg_change = balance_tracking_df['hourly_change_btc'].mean()
                st.metric("Avg Hourly Change", f"{avg_change:.6f} BTC")
            
            with col3:
                total_transactions = balance_tracking_df['transaction_count'].sum()
                st.metric("Total Transactions", f"{total_transactions:,}")
            
            with col4:
                active_pools = balance_tracking_df['pool_type'].nunique()
                st.metric("Active Pools", f"{active_pools}")
            
            # Balance tracking data table
            st.markdown("### Hourly Balance Changes")
            
            # Format the data for display
            display_df = balance_tracking_df.copy()
            display_df = display_df.rename(columns={
                'hour': 'Hour',
                'pool_type': 'Pool Type',
                'hourly_change_btc': 'Hourly Change (BTC)',
                'ending_balance_btc': 'Ending Balance (BTC)',
                'transaction_count': 'Transactions',
                'ending_balance_usd': 'Ending Balance (USD)'
            })
            
            # Format numeric columns
            numeric_format_cols = ['Hourly Change (BTC)', 'Ending Balance (BTC)']
            for col in numeric_format_cols:
                if col in display_df.columns:
                    display_df[col] = display_df[col].round(8)
            
            if 'Ending Balance (USD)' in display_df.columns:
                display_df['Ending Balance (USD)'] = display_df['Ending Balance (USD)'].round(2)
            
            # Show data table with filters
            pool_filter = st.multiselect(
                "Filter by Pool Type",
                options=display_df['Pool Type'].unique(),
                default=display_df['Pool Type'].unique()
            )
            
            filtered_df = display_df[display_df['Pool Type'].isin(pool_filter)]
            
            st.dataframe(
                filtered_df[['Hour', 'Pool Type', 'Hourly Change (BTC)', 'Ending Balance (BTC)', 'Transactions']].head(50),
                use_container_width=True,
                hide_index=True
            )
            
            # Download option
            csv = filtered_df.to_csv(index=False)
            st.download_button(
                label="📥 Download Balance Tracking Data",
                data=csv,
                file_name=f"balance_tracking_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                mime="text/csv"
            )
            
            # Balance changes chart
            if len(filtered_df) > 1:
                st.markdown("### Balance Changes Over Time")
                
                fig = go.Figure()
                
                for pool_type in filtered_df['Pool Type'].unique():
                    pool_data = filtered_df[filtered_df['Pool Type'] == pool_type].sort_values('Hour')
                    
                    fig.add_trace(go.Scatter(
                        x=pool_data['Hour'],
                        y=pool_data['Ending Balance (BTC)'],
                        mode='lines+markers',
                        name=f'{pool_type.title()} Pool',
                        line=dict(width=2)
                    ))
                
                fig.update_layout(
                    title='Pool Balances Over Time (Dune Analytics Style)',
                    xaxis_title='Time',
                    yaxis_title='Balance (BTC)',
                    hovermode='x unified',
                    legend=dict(x=0.02, y=0.98)
                )
                
                st.plotly_chart(fig, use_container_width=True)
                
        else:
            st.info("Balance tracking data will appear here once the enhanced indexer runs with the new balance tracking module.")
            st.markdown("""
            **What this will show:**
            - Hourly balance changes for each pool (Active, Default, Stability, CollSurplus)
            - Cumulative balance tracking over time
            - Transaction counts and flow analysis
            - Equivalent to Dune Analytics balance tracking queries
            """)

def render_bpd_analytics():
    """Render BPD analytics section"""
    bpd_df = fetch_bpd_supply_data()
    
    if bpd_df.empty:
        st.warning("No BPD supply data available yet. The indexer will collect this data during regular operations.")
        return
    
    # Get latest supply
    latest_supply = bpd_df.iloc[0]  # Most recent
    
    st.markdown("## 🪙 BPD Supply Analytics")
    
    # Supply metrics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            "Current Supply",
            f"{latest_supply['total_supply_bpd']:,.2f}",
            help="Total BPD tokens in circulation"
        )
    
    with col2:
        if len(bpd_df) > 1:
            prev_supply = bpd_df.iloc[1]['total_supply_bpd']
            supply_change = latest_supply['total_supply_bpd'] - prev_supply
            st.metric(
                "Recent Change",
                f"{supply_change:+,.2f}",
                help="Change since last snapshot"
            )
        else:
            st.metric("Recent Change", "N/A")
    
    with col3:
        # Calculate max supply if available
        max_supply = bpd_df['total_supply_bpd'].max()
        st.metric(
            "Max Supply",
            f"{max_supply:,.2f}",
            help="Maximum supply recorded"
        )
    
    with col4:
        # Calculate min supply
        min_supply = bpd_df['total_supply_bpd'].min()
        st.metric(
            "Min Supply",
            f"{min_supply:,.2f}",
            help="Minimum supply recorded"
        )
    
    # Supply chart
    st.markdown("### BPD Supply Over Time")
    fig = px.line(
        bpd_df.sort_values('timestamp'),
        x='timestamp',
        y='total_supply_bpd',
        title='BPD Token Supply Over Time',
        labels={'timestamp': 'Time', 'total_supply_bpd': 'BPD Supply'}
    )
    fig.update_layout(hovermode='x unified')
    st.plotly_chart(fig, use_container_width=True)

def render_staking_gains_analytics():
    """Render staking gains analytics section"""
    staking_df = fetch_staking_gains_data()
    
    if staking_df.empty:
        st.warning("No staking gains data available yet. The indexer will collect this data during regular operations.")
        return
    
    st.markdown("## 📈 Gains from Staking Analytics")
    
    # Latest gains
    latest_gains = staking_df.iloc[0]  # Most recent
    
    # Metrics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            "Latest Daily Gain",
            f"{latest_gains.get('daily_gain', 0):.6f}",
            help="Most recent daily gain amount"
        )
    
    with col2:
        total_gain = staking_df.get('cumulative_gain', staking_df.get('daily_gain', 0)).sum()
        st.metric(
            "Total Gains",
            f"{total_gain:.6f}",
            help="Total gains accumulated"
        )
    
    with col3:
        avg_gain = staking_df.get('daily_gain', 0).mean()
        st.metric(
            "Average Daily Gain",
            f"{avg_gain:.6f}",
            help="Average daily gain"
        )
    
    with col4:
        active_days = len(staking_df[staking_df.get('daily_gain', 0) > 0])
        st.metric(
            "Active Days",
            f"{active_days:,}",
            help="Days with positive gains"
        )
    
    # Gains chart
    st.markdown("### Daily Staking Gains")
    fig = px.bar(
        staking_df.sort_values('day'),
        x='day',
        y='daily_gain',
        title='Daily Staking Gains Over Time',
        labels={'day': 'Date', 'daily_gain': 'Daily Gain'}
    )
    st.plotly_chart(fig, use_container_width=True)
    
    # Cumulative gains if available
    if 'cumulative_gain' in staking_df.columns:
        st.markdown("### Cumulative Staking Gains")
        fig = px.line(
            staking_df.sort_values('day'),
            x='day',
            y='cumulative_gain',
            title='Cumulative Staking Gains Over Time',
            labels={'day': 'Date', 'cumulative_gain': 'Cumulative Gain'}
        )
        st.plotly_chart(fig, use_container_width=True)

def render_redemption_gains_analytics():
    """Render redemption gains analytics section"""
    redemption_df = fetch_redemption_gains_data()
    
    if redemption_df.empty:
        st.warning("No redemption gains data available yet. The indexer will collect this data during regular operations.")
        return
    
    st.markdown("## 🔄 Redemption Gains from Staking Analytics")
    
    # Latest gains
    latest_gains = redemption_df.iloc[0]  # Most recent
    
    # Metrics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            "Latest Daily Gain",
            f"{latest_gains.get('daily_redemption_gain', 0):.6f}",
            help="Most recent daily redemption gain"
        )
    
    with col2:
        total_gain = redemption_df.get('daily_redemption_gain', 0).sum()
        st.metric(
            "Total Redemption Gains",
            f"{total_gain:.6f}",
            help="Total redemption gains"
        )
    
    with col3:
        avg_gain = redemption_df.get('daily_redemption_gain', 0).mean()
        st.metric(
            "Average Daily Gain",
            f"{avg_gain:.6f}",
            help="Average daily redemption gain"
        )
    
    with col4:
        active_days = len(redemption_df[redemption_df.get('daily_redemption_gain', 0) > 0])
        st.metric(
            "Active Days",
            f"{active_days:,}",
            help="Days with redemption activity"
        )
    
    # Redemption gains chart
    st.markdown("### Daily Redemption Gains")
    fig = px.bar(
        redemption_df.sort_values('day'),
        x='day',
        y='daily_redemption_gain',
        title='Daily Redemption Gains Over Time',
        labels={'day': 'Date', 'daily_redemption_gain': 'Daily Redemption Gain'}
    )
    st.plotly_chart(fig, use_container_width=True)

def render_mp_staking_analytics():
    """Render MP staking analytics section"""
    mp_staking_df = fetch_mp_staking_data()
    wallets_df, summary = fetch_mp_staking_wallets()
    
    st.markdown("## 🎯 MP Staking Analytics")
    st.markdown("Track total MP staked and individual wallet breakdown (equivalent to Liquity's LQTY staking)")
    
    # Use real-time data from API if available, otherwise fall back to database
    if summary:
        current_mp_staked = summary.get('total_mp_staked', 0)
        current_mp_rewards = summary.get('total_mp_rewards', 0)
        total_wallets = summary.get('total_wallets', 0)
        blocks_scanned = summary.get('blocks_scanned', 'N/A')
    elif not mp_staking_df.empty:
        latest_data = mp_staking_df.iloc[0]
        current_mp_staked = latest_data['total_mp_staked']
        current_mp_rewards = latest_data['total_mp_claimed']
        total_wallets = 'N/A'
        blocks_scanned = 'N/A'
    else:
        st.warning("No MP staking data available yet. The indexer will collect this data once MP staking events are detected on-chain.")
        return
    
    # Metrics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            "Current MP Staked",
            f"{current_mp_staked:,.2f}",
            help="Total MP tokens currently staked across all wallets"
        )
    
    with col2:
        st.metric(
            "Total MP Rewards",
            f"{current_mp_rewards:,.2f}",
            help="Total MP rewards distributed"
        )
    
    with col3:
        st.metric(
            "Active Wallets",
            f"{total_wallets:,}" if isinstance(total_wallets, (int, float)) else str(total_wallets),
            help="Number of unique wallets staking MP"
        )
    
    with col4:
        if isinstance(blocks_scanned, str) and '-' in blocks_scanned:
            start_block, end_block = blocks_scanned.split('-')
            blocks_range = f"{int(end_block) - int(start_block):,}"
        else:
            blocks_range = str(blocks_scanned)
        st.metric(
            "Blocks Scanned",
            blocks_range,
            help="Range of blocks scanned for staking events"
        )
    
    # Individual Wallet Breakdown Table
    if not wallets_df.empty:
        st.markdown("### 👥 Individual MP Staking Wallets")
        st.markdown("Real-time breakdown of all wallets staking MP tokens")
        
        try:
            # Prepare display data
            display_df = wallets_df.copy()
            
            # Debug: Show column names
            st.write("Debug - Available columns:", list(wallets_df.columns))
            
            # Format wallet addresses (show first 6 and last 4 characters)
            if 'wallet_address' in display_df.columns:
                display_df['wallet_display'] = display_df['wallet_address'].apply(
                    lambda x: f"{x[:6]}...{x[-4:]}"
                )
            else:
                st.error("Missing 'wallet_address' column in API response")
                return
        
            # Create formatted display table
            table_data = []
            required_columns = ['total_mp_staked', 'percentage_of_total', 'last_activity_block', 'transaction_count']
            
            # Check if all required columns exist
            missing_columns = [col for col in required_columns if col not in display_df.columns]
            if missing_columns:
                st.error(f"Missing required columns: {missing_columns}")
                st.write("Available data:", display_df.head())
                return
            
            for _, row in display_df.iterrows():
                table_data.append({
                    'Wallet': row['wallet_display'],
                    'MP Staked': f"{row['total_mp_staked']:,.0f}",
                    'Percentage': f"{row['percentage_of_total']:.2f}%",
                    'Last Activity': f"Block {row['last_activity_block']:,}",
                    'Transactions': f"{row['transaction_count']:,}",
                    'Full Address': row['wallet_address']
                })
            
            table_df = pd.DataFrame(table_data)
            
            # Display table
            st.dataframe(
                table_df[['Wallet', 'MP Staked', 'Percentage', 'Last Activity', 'Transactions']],
                use_container_width=True,
                hide_index=True
            )
        
            # Pie chart of wallet distribution
            col1, col2 = st.columns(2)
            
            with col1:
                # Pie chart
                try:
                    fig = px.pie(
                        display_df,
                        values='total_mp_staked',
                        names='wallet_display',
                        title='MP Staking Distribution by Wallet',
                        color_discrete_sequence=px.colors.qualitative.Set3
                    )
                    fig.update_traces(textposition='inside', textinfo='percent+label')
                    fig.update_layout(showlegend=False)
                    st.plotly_chart(fig, use_container_width=True)
                except Exception as e:
                    st.error(f"Error creating pie chart: {str(e)}")
                    st.write("Data for pie chart:", display_df[['wallet_display', 'total_mp_staked']].head())
            
            with col2:
                # Bar chart
                try:
                    fig = px.bar(
                        display_df.sort_values('total_mp_staked', ascending=True),
                        x='total_mp_staked',
                        y='wallet_display',
                        orientation='h',
                        title='MP Staked by Wallet',
                        labels={'total_mp_staked': 'MP Staked', 'wallet_display': 'Wallet'},
                        color='total_mp_staked',
                        color_continuous_scale='Blues'
                    )
                    fig.update_layout(showlegend=False, yaxis={'categoryorder': 'total ascending'})
                    st.plotly_chart(fig, use_container_width=True)
                except Exception as e:
                    st.error(f"Error creating bar chart: {str(e)}")
                    st.write("Data for bar chart:", display_df[['wallet_display', 'total_mp_staked']].head())
            
            # Recent transactions
            st.markdown("### 📋 Recent MP Staking Transactions")
            
            try:
                # Flatten transaction data
                all_transactions = []
                for _, wallet in wallets_df.iterrows():
                    wallet_display = f"{wallet['wallet_address'][:6]}...{wallet['wallet_address'][-4:]}"
                    for tx in wallet.get('recent_transactions', []):
                        all_transactions.append({
                            'Wallet': wallet_display,
                            'Transaction Hash': tx.get('hash', ''),
                            'Block': tx.get('block', ''),
                            'Event Type': tx.get('eventType', ''),
                            'Amount': f"{tx.get('amount', 0):,.2f}",
                            'Full Address': wallet['wallet_address']
                        })
                
                if all_transactions:
                    tx_df = pd.DataFrame(all_transactions)
                    tx_df = tx_df.sort_values('Block', ascending=False)
                    
                    st.dataframe(
                        tx_df[['Wallet', 'Transaction Hash', 'Block', 'Event Type', 'Amount']].head(20),
                        use_container_width=True,
                        hide_index=True
                    )
                else:
                    st.info("No recent transactions found")
            except Exception as e:
                st.error(f"Error processing transaction data: {str(e)}")
                st.write("Available wallet data:", wallets_df.columns.tolist())
            
            # Download button for full wallet data
            csv = wallets_df.to_csv(index=False)
            st.download_button(
                label="📥 Download MP Staking Data",
                data=csv,
                file_name=f"mp_staking_wallets_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                mime="text/csv"
            )
                
        except Exception as e:
            st.error(f"Error processing MP staking wallet data: {str(e)}")
            st.write("Raw API response:", summary)
            st.write("Wallets dataframe shape:", wallets_df.shape if not wallets_df.empty else "Empty")
    else:
        st.info("No MP staking wallet data available. Wallets will appear here once staking events are detected.")
    
    # Time Series Charts (only show if historical data available)
    if not mp_staking_df.empty:
        st.markdown("---")
        st.markdown("### 📈 Historical MP Staking Trends")
        st.markdown("*Note: Real-time current data shown above, historical trends below*")
        
        st.markdown("#### MP Staked Over Time")
        fig = px.line(
            mp_staking_df.sort_values('hour'),
            x='hour',
            y='total_mp_staked',
            title='Total MP Staked',
            labels={'hour': 'Time', 'total_mp_staked': 'MP Staked'}
        )
        fig.update_layout(hovermode='x unified')
        st.plotly_chart(fig, use_container_width=True)
        
        # Combined staking and claims chart
        st.markdown("#### MP Staking vs Claims (Dune-style Analytics)")
        
        fig = go.Figure()
        
        fig.add_trace(go.Scatter(
            x=mp_staking_df['hour'],
            y=mp_staking_df['total_mp_staked'],
            mode='lines',
            name='Total MP Staked',
            line=dict(color='#3b82f6', width=2)
        ))
        
        fig.add_trace(go.Scatter(
            x=mp_staking_df['hour'],
            y=mp_staking_df['total_mp_claimed'],
            mode='lines',
            name='Total MP Claimed',
            line=dict(color='#10b981', width=2)
        ))
        
        fig.update_layout(
            title='MP Staking Analytics (Total Staked vs Total Claimed)',
            xaxis_title='Time',
            yaxis_title='MP Amount',
            hovermode='x unified',
            legend=dict(x=0.02, y=0.98)
        )
        
        st.plotly_chart(fig, use_container_width=True)
        
        # Claims analysis
        st.markdown("#### MP Claims Analysis")
        col1, col2 = st.columns(2)
        
        with col1:
            # Total MP claimed over time
            fig = px.line(
                mp_staking_df.sort_values('hour'),
                x='hour',
                y='total_mp_claimed',
                title='Cumulative MP Claimed',
                labels={'hour': 'Time', 'total_mp_claimed': 'Total MP Claimed'},
                color_discrete_sequence=['#10b981']
            )
            fig.update_layout(hovermode='x unified')
            st.plotly_chart(fig, use_container_width=True)
        
        with col2:
            # Hourly MP claims
            hourly_claims = mp_staking_df[mp_staking_df['mp_claimed_in_hour'] > 0]
            if not hourly_claims.empty:
                fig = px.bar(
                    hourly_claims.sort_values('hour'),
                    x='hour',
                    y='mp_claimed_in_hour',
                    title='MP Claimed Per Hour',
                    labels={'hour': 'Time', 'mp_claimed_in_hour': 'MP Claimed'},
                    color_discrete_sequence=['#f59e0b']
                )
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("No MP claims recorded yet")

# ===========================================
# MAIN CONTENT RENDERING
# ===========================================

# Render content based on selected section
if analytics_section == "🏠 Overview":
    render_overview()
elif analytics_section == "🏦 Vault Analytics":
    render_vault_analytics()
elif analytics_section == "💰 TVL Analytics":
    render_tvl_analytics()
elif analytics_section == "🪙 BPD Analytics":
    render_bpd_analytics()
elif analytics_section == "📈 Gains from Staking Analytics":
    render_staking_gains_analytics()
elif analytics_section == "🔄 Redemption Gains from Staking Analytics":
    render_redemption_gains_analytics()
elif analytics_section == "🎯 MP Staking Analytics":
    render_mp_staking_analytics()

# ===========================================
# FOOTER
# ===========================================

# Auto-refresh option in sidebar
auto_refresh = st.sidebar.checkbox("Auto-refresh", value=False)

# Footer
st.markdown("---")
st.markdown(
    f"""
    <div style="text-align: center; color: #6b7280; padding: 1rem;">
        Money Protocol Analytics Dashboard | Real-time RSK Testnet Data
        <br>Last updated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}<br>
        <small>Auto-refresh: {'Enabled' if auto_refresh else 'Disabled'}</small>
    </div>
    """,
    unsafe_allow_html=True
)

# Auto-refresh logic
if auto_refresh:
    st.rerun()