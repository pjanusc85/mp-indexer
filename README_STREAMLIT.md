# Money Protocol Analytics Dashboard (Streamlit)

## 🚀 Quick Deploy to Streamlit Cloud (Recommended)

1. **Fork or push this repo to GitHub**

2. **Go to [share.streamlit.io](https://share.streamlit.io)**

3. **Deploy your app:**
   - Click "New app"
   - Connect your GitHub account
   - Select your repository: `mp-indexer`
   - Branch: `main`
   - Main file path: `streamlit_app.py`

4. **Add Environment Variables:**
   In Streamlit Cloud settings, add:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. **Click Deploy!**

Your app will be live at: `https://[your-app-name].streamlit.app`

## 🖥️ Local Development

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Create `.env` file:**
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Run the app:**
   ```bash
   streamlit run streamlit_app.py
   ```

4. **Open browser:**
   Navigate to `http://localhost:8501`

## 📊 Features

- **Real-time Analytics**: Live data from your vault events
- **Interactive Charts**: Powered by Plotly
- **Time Range Filters**: 24h, 7d, 30d, 90d, or custom
- **Event Type Filtering**: VaultUpdated, VaultLiquidated
- **Top Vaults Analysis**: Most active vaults
- **Data Export**: Download CSV of filtered data
- **Auto-refresh**: Updates every 60 seconds

## 🔧 Alternative Deployment Options

### Deploy to Render

1. Create account at [render.com](https://render.com)
2. Create new Web Service
3. Connect GitHub repo
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `streamlit run streamlit_app.py --server.port $PORT`
6. Add environment variables in Render dashboard

### Deploy to Railway

1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Initialize: `railway init`
4. Add variables: `railway variables set SUPABASE_URL=xxx`
5. Deploy: `railway up`

### Deploy to Heroku

1. Create `Procfile`:
   ```
   web: sh setup.sh && streamlit run streamlit_app.py
   ```

2. Create `setup.sh`:
   ```bash
   mkdir -p ~/.streamlit/
   echo "[server]\nport = $PORT\nenableCORS = false\nheadless = true\n" > ~/.streamlit/config.toml
   ```

3. Deploy with Heroku CLI

## 📝 Notes

- **Cannot deploy on Vercel** - Vercel doesn't support Python/Streamlit
- Streamlit Cloud is free for public repos
- The dashboard auto-refreshes every 60 seconds when enabled
- All data is fetched directly from your Supabase database

## 🆘 Troubleshooting

1. **No data showing**: Check your Supabase credentials
2. **Connection errors**: Verify SUPABASE_URL includes `https://`
3. **Permission denied**: Check Supabase RLS policies
4. **Slow loading**: Consider adding indexes to your database

## 📧 Support

For issues, please check the main repository documentation or create an issue on GitHub.