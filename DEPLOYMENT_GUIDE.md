# 🚀 GitHub Pages Deployment Guide

## Quick Deploy (3 Steps)

### Step 1: Create GitHub Repository
1. Go to [GitHub](https://github.com)
2. Click **New Repository**
3. Name it: `calculator-vault` (or any name)
4. Make it **Public**
5. Click **Create Repository**

### Step 2: Upload Files
**Option A - GitHub Web Interface:**
1. Open your new repository
2. Click **"Add file"** → **"Upload files"**
3. Upload ALL files from the `deploy` folder:
   - `.github/` folder
   - `src/` folder
   - All config files (package.json, vite.config.ts, etc.)
   - README.md

**Option B - Git Command Line:**
```bash
# Navigate to deploy folder
cd deploy

# Initialize git
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/calculator-vault.git
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. Go to repository **Settings**
2. Click **Pages** in left sidebar
3. Under **Build and deployment**:
   - Source: **GitHub Actions**
4. The workflow will automatically deploy your app!

5. Wait 2-3 minutes, then visit:
   ```
   https://YOUR_USERNAME.github.io/calculator-vault
   ```

---

## 📁 Files to Upload

```
calculator-vault/
├── .github/
│   └── workflows/
│       └── deploy.yml      ← Auto-deployment config
├── src/
│   ├── components/
│   │   ├── ads/            ← Ad components
│   │   └── ui/             ← UI components
│   ├── App.tsx             ← Main app
│   ├── App.css             ← Styles
│   ├── main.tsx            ← Entry point
│   └── ...
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── README.md
└── .gitignore
```

---

## ⚙️ Customization

### Change Repository Name?
If you use a different repo name, update `vite.config.ts`:

```typescript
export default defineConfig({
  base: '/YOUR_REPO_NAME/',  // ← Change this
  // ... rest of config
});
```

### Custom Domain?
1. Add a file named `CNAME` in `public/` folder
2. Put your domain name inside:
   ```
   www.yourdomain.com
   ```
3. Update DNS settings with your domain provider

---

## 💰 Enable Real AdMob Ads

### 1. Get Ad Unit IDs from AdMob
- Banner Ad: `ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy`
- Interstitial: `ca-app-pub-xxxxxxxxxxxxxxxx/wwwwwwwwww`
- Native Ad: `ca-app-pub-xxxxxxxxxxxxxxxx/zzzzzzzzzz`
- Rewarded Ad: `ca-app-pub-xxxxxxxxxxxxxxxx/aaaaaaaaaa`

### 2. Update Code
Edit these files with your real ad unit IDs:
- `src/components/ads/BannerAd.tsx`
- `src/components/ads/NativeAd.tsx`
- `src/components/ads/RewardedAd.tsx`

### 3. Rebuild & Deploy
```bash
npm install
npm run build
git add .
git commit -m "Update ad units"
git push
```

---

## 🐛 Troubleshooting

### Build Failed?
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 404 Error on GitHub Pages?
1. Check if `base` in `vite.config.ts` matches your repo name
2. Wait 5 minutes for deployment
3. Clear browser cache

### Ads Not Showing?
- AdMob requires a **published app** on Play Store
- For testing, use **Test Ad Unit IDs** from AdMob docs

---

## 📊 Expected Earnings

| Ad Type | Monthly Impressions | Estimated Earnings |
|---------|--------------------|--------------------|
| Banner | 10,000 | $5 - $20 |
| Interstitial | 5,000 | $15 - $40 |
| Native | 3,000 | $3 - $12 |
| Rewarded | 2,000 | $10 - $30 |
| **Total** | **20,000** | **$33 - $102** |

*Earnings depend on user location, engagement, and ad quality.*

---

## 🎉 Success!

Your app is now live! Share the link:
```
https://YOUR_USERNAME.github.io/calculator-vault
```

---

**Need Help?** Create an issue on GitHub or check the README.md file.
