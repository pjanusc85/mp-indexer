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
    .stMetric {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    }
    .stMetric > div {
        color: #1f2937 !important;
    }
    .stMetric label {
        color: #6b7280 !important;
    }
    .stMetric [data-testid="metric-container"] {
        background-color: #f0f2f6;
        border: 1px solid #e5e7eb;
        padding: 1rem;
        border-radius: 0.5rem;
    }
    .stMetric [data-testid="metric-container"] > div {
        color: #1f2937 !important;
    }
    h1 {
        color: #1f2937;
        border-bottom: 2px solid #3b82f6;
        padding-bottom: 0.5rem;
    }
    .plot-container {
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        padding: 1rem;
        background-color: white;
    }
</style>
""", unsafe_allow_html=True)

# Title and description
st.title("🏦 Money Protocol Analytics Dashboard")
st.markdown("Real-time analytics for vault events on RSK testnet")

# Sidebar filters
st.sidebar.header("⚙️ Filters")

# Time range selector
time_range = st.sidebar.selectbox(
    "Time Range",
    ["Last 24 Hours", "Last 7 Days", "Last 30 Days", "Last 90 Days", "All Time"],
    index=4  # Default to "All Time" to show existing data
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

# Event type filter
event_types = st.sidebar.multiselect(
    "Event Types",
    ["VaultUpdated", "VaultLiquidated"],
    default=["VaultUpdated", "VaultLiquidated"]
)

# Data fetching functions
@st.cache_data(ttl=60)  # Cache for 1 minute
def fetch_vault_events(start_date, end_date, event_types):
    try:
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json'
        }
        
        # For "All Time", don't add date filters
        if start_date.year == 2023:  # Our "All Time" default
            url = f'{SUPABASE_URL}/rest/v1/vault_events?select=*&order=timestamp.asc'
        else:
            # Build URL with proper Supabase query format
            url = f'{SUPABASE_URL}/rest/v1/vault_events?select=*'
            url += f'&timestamp=gte.{start_date.isoformat()}'
            url += f'&timestamp=lte.{end_date.isoformat()}'
            url += '&order=timestamp.asc'
        
        if event_types:
            url += f'&event_type=in.({",".join(event_types)})'
        
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            st.sidebar.success(f"✅ Found {len(data)} events")
            return pd.DataFrame(data)
        else:
            st.sidebar.error(f"❌ Error: {response.status_code}")
            st.sidebar.code(response.text)
            return pd.DataFrame()
    except Exception as e:
        st.sidebar.error(f"❌ Exception: {str(e)}")
        return pd.DataFrame()

@st.cache_data(ttl=60)
def fetch_summary_stats(start_date, end_date):
    try:
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
        }
        
        # Build URL with proper Supabase query format
        if start_date.year == 2023:  # "All Time"
            url = f'{SUPABASE_URL}/rest/v1/vault_events?select=*'
        else:
            url = f'{SUPABASE_URL}/rest/v1/vault_events?select=*'
            url += f'&timestamp=gte.{start_date.isoformat()}'
            url += f'&timestamp=lte.{end_date.isoformat()}'
        
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            df = pd.DataFrame(response.json())
            
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
        else:
            st.error(f"Error fetching summary: {response.status_code}")
            return {
                'total_events': 0,
                'unique_vaults': 0,
                'total_updates': 0,
                'total_liquidations': 0,
                'latest_block': 0
            }
    except Exception as e:
        st.error(f"Error fetching summary stats: {str(e)}")
        return {
            'total_events': 0,
            'unique_vaults': 0,
            'total_updates': 0,
            'total_liquidations': 0,
            'latest_block': 0
        }

# Fetch data
df = fetch_vault_events(start_date, end_date, event_types)
stats = fetch_summary_stats(start_date, end_date)

# Display metrics
st.markdown("## 📈 Key Metrics")
col1, col2, col3, col4, col5 = st.columns(5)

with col1:
    st.markdown(f"""
    <div style="background-color: #f8fafc; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; text-align: center;">
        <div style="color: #64748b; font-size: 0.875rem; font-weight: 500;">Total Events</div>
        <div style="color: #1e293b; font-size: 1.875rem; font-weight: 700;">{stats['total_events']:,}</div>
    </div>
    """, unsafe_allow_html=True)

with col2:
    st.markdown(f"""
    <div style="background-color: #f8fafc; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; text-align: center;">
        <div style="color: #64748b; font-size: 0.875rem; font-weight: 500;">Unique Vaults</div>
        <div style="color: #1e293b; font-size: 1.875rem; font-weight: 700;">{stats['unique_vaults']:,}</div>
    </div>
    """, unsafe_allow_html=True)

with col3:
    st.markdown(f"""
    <div style="background-color: #f8fafc; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; text-align: center;">
        <div style="color: #64748b; font-size: 0.875rem; font-weight: 500;">Vault Updates</div>
        <div style="color: #059669; font-size: 1.875rem; font-weight: 700;">{stats['total_updates']:,}</div>
    </div>
    """, unsafe_allow_html=True)

with col4:
    st.markdown(f"""
    <div style="background-color: #f8fafc; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; text-align: center;">
        <div style="color: #64748b; font-size: 0.875rem; font-weight: 500;">Liquidations</div>
        <div style="color: #dc2626; font-size: 1.875rem; font-weight: 700;">{stats['total_liquidations']:,}</div>
    </div>
    """, unsafe_allow_html=True)

with col5:
    st.markdown(f"""
    <div style="background-color: #f8fafc; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; text-align: center;">
        <div style="color: #64748b; font-size: 0.875rem; font-weight: 500;">Latest Block</div>
        <div style="color: #1e293b; font-size: 1.875rem; font-weight: 700;">{stats['latest_block']:,}</div>
    </div>
    """, unsafe_allow_html=True)

# Data processing
if not df.empty:
    
    # Convert timestamp to datetime with robust error handling
    try:
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce', utc=True)
        # Remove any rows with invalid timestamps
        df = df.dropna(subset=['timestamp'])
        if df.empty:
            st.error("No valid timestamp data found")
            st.stop()
        df['date'] = df['timestamp'].dt.date
        df['hour'] = df['timestamp'].dt.hour
    except Exception as e:
        st.error(f"Error processing timestamps: {e}")
        st.code(f"Sample timestamp data: {df['timestamp'].head().tolist()}")
        st.stop()
    
    # Create tabs for different visualizations
    tab1, tab2, tab3, tab4, tab5 = st.tabs(["📊 Overview", "📈 Trends", "🏆 Top Vaults", "🔍 Event Details", "📋 Raw Data"])
    
    with tab1:
        col1, col2 = st.columns(2)
        
        with col1:
            # Event type distribution
            st.markdown("### Event Type Distribution")
            event_counts = df['event_type'].value_counts()
            fig = px.pie(
                values=event_counts.values,
                names=event_counts.index,
                color_discrete_map={'VaultUpdated': '#3b82f6', 'VaultLiquidated': '#ef4444'}
            )
            fig.update_traces(textposition='inside', textinfo='percent+label')
            st.plotly_chart(fig, use_container_width=True)
        
        with col2:
            # Hourly distribution
            st.markdown("### Activity by Hour of Day")
            hourly_data = df.groupby('hour').size().reset_index(name='count')
            fig = px.bar(
                hourly_data, 
                x='hour', 
                y='count',
                labels={'hour': 'Hour of Day', 'count': 'Event Count'},
                color_discrete_sequence=['#3b82f6']
            )
            st.plotly_chart(fig, use_container_width=True)
    
    with tab2:
        # Daily events trend
        st.markdown("### Daily Event Trends")
        daily_events = df.groupby(['date', 'event_type']).size().reset_index(name='count')
        fig = px.line(
            daily_events,
            x='date',
            y='count',
            color='event_type',
            labels={'date': 'Date', 'count': 'Event Count'},
            color_discrete_map={'VaultUpdated': '#3b82f6', 'VaultLiquidated': '#ef4444'}
        )
        fig.update_layout(hovermode='x unified')
        st.plotly_chart(fig, use_container_width=True)
        
        # Cumulative events
        st.markdown("### Cumulative Events Over Time")
        df_sorted = df.sort_values('timestamp')
        df_sorted['cumulative'] = range(1, len(df_sorted) + 1)
        fig = px.area(
            df_sorted,
            x='timestamp',
            y='cumulative',
            labels={'timestamp': 'Time', 'cumulative': 'Total Events'},
            color_discrete_sequence=['#10b981']
        )
        st.plotly_chart(fig, use_container_width=True)
    
    with tab3:
        # Top vaults
        st.markdown("### Most Active Vaults")
        if 'vault_id' in df.columns:
            vault_activity = df[df['vault_id'].notna()].groupby('vault_id').agg({
                'event_type': 'count',
                'timestamp': ['min', 'max']
            }).reset_index()
            vault_activity.columns = ['vault_id', 'event_count', 'first_seen', 'last_seen']
            vault_activity = vault_activity.sort_values('event_count', ascending=False).head(10)
            
            # Add event type breakdown
            vault_events = df[df['vault_id'].isin(vault_activity['vault_id'])].groupby(['vault_id', 'event_type']).size().unstack(fill_value=0)
            vault_activity = vault_activity.merge(vault_events, on='vault_id', how='left')
            
            # Display as table
            st.dataframe(
                vault_activity,
                use_container_width=True,
                hide_index=True,
                column_config={
                    "vault_id": st.column_config.TextColumn("Vault ID", width="medium"),
                    "event_count": st.column_config.NumberColumn("Total Events", format="%d"),
                    "first_seen": st.column_config.DatetimeColumn("First Seen", format="YYYY-MM-DD HH:mm"),
                    "last_seen": st.column_config.DatetimeColumn("Last Seen", format="YYYY-MM-DD HH:mm"),
                }
            )
            
            # Bar chart of top vaults
            fig = px.bar(
                vault_activity.head(10),
                x='vault_id',
                y='event_count',
                labels={'vault_id': 'Vault ID', 'event_count': 'Event Count'},
                color_discrete_sequence=['#3b82f6']
            )
            fig.update_layout(xaxis_tickangle=45)
            st.plotly_chart(fig, use_container_width=True)
    
    with tab4:
        # Recent events
        st.markdown("### Recent Events")
        
        # Event filter
        col1, col2 = st.columns([3, 1])
        with col1:
            search_vault = st.text_input("Search by Vault ID", placeholder="Enter vault ID...")
        with col2:
            limit = st.number_input("Show events", min_value=10, max_value=100, value=20, step=10)
        
        recent_df = df.sort_values('timestamp', ascending=False)
        
        if search_vault:
            recent_df = recent_df[recent_df['vault_id'].str.contains(search_vault, case=False, na=False)]
        
        recent_df = recent_df.head(limit)
        
        # Display events
        for _, event in recent_df.iterrows():
            event_color = "#3b82f6" if event['event_type'] == 'VaultUpdated' else "#ef4444"
            st.markdown(f"""
            <div style="border-left: 3px solid {event_color}; padding: 10px; margin: 10px 0; background-color: #f9fafb;">
                <strong>{event['event_type']}</strong> | Block: {event['block_number']} | {event['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}
                <br>Vault: <code>{event['vault_id']}</code>
                <br>Tx: <code>{event['transaction_hash']}</code>
            </div>
            """, unsafe_allow_html=True)
    
    with tab5:
        # Raw data
        st.markdown("### Raw Event Data")
        st.info(f"Showing {len(df)} events from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
        
        # Download button
        csv = df.to_csv(index=False)
        st.download_button(
            label="📥 Download CSV",
            data=csv,
            file_name=f"vault_events_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv"
        )
        
        # Display dataframe
        st.dataframe(
            df.sort_values('timestamp', ascending=False),
            use_container_width=True,
            hide_index=True,
            column_config={
                "timestamp": st.column_config.DatetimeColumn("Timestamp", format="YYYY-MM-DD HH:mm:ss"),
                "block_number": st.column_config.NumberColumn("Block", format="%d"),
                "vault_id": st.column_config.TextColumn("Vault ID"),
                "event_type": st.column_config.TextColumn("Event Type"),
                "transaction_hash": st.column_config.TextColumn("Transaction Hash"),
            }
        )
else:
    st.warning("No data available for the selected time range and filters.")

# Auto-refresh (moved to sidebar only)  
auto_refresh = st.sidebar.checkbox("Auto-refresh", value=False)

# Footer - only render once at the end
st.markdown("---")
st.markdown(
    f"""
    <div style="text-align: center; color: #6b7280; padding: 1rem;">
        Money Protocol Indexer Analytics | Real-time RSK Testnet Data
        <br>Last updated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}<br>
        <small>Auto-refresh: {'Enabled' if auto_refresh else 'Disabled'}</small>
    </div>
    """,
    unsafe_allow_html=True
)