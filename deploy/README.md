# 🔐 Secret Calculator Vault

A calculator app with a hidden photo vault - perfect for keeping your private photos secure!

![Calculator Vault](https://img.shields.io/badge/Calculator-Vault-blue)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss)

## ✨ Features

- 🔢 **Fully Functional Calculator** - All basic operations
- 🔐 **PIN Protected Vault** - 4-6 digit PIN security
- 📸 **Photo Storage** - Hide your private photos
- 📱 **Mobile Responsive** - Works on all devices
- 💰 **AdMob Ready** - Pre-configured ad placements
- 🎨 **Modern UI** - Clean, dark theme design

## 🚀 Live Demo

[View Live App](https://your-username.github.io/your-repo-name)

## 📱 How to Use

1. **Calculator Mode**: Use as a normal calculator
2. **Access Vault**: Long press the `=` button for 2 seconds
3. **Set PIN**: First time users need to create a PIN
4. **Add Photos**: Click "Add Photo to Vault" to hide photos
5. **View Photos**: Enter PIN to access your hidden photos

## 🛠️ Development

### Prerequisites
- Node.js 20+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/your-repo-name.git

# Navigate to project
cd your-repo-name

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 📦 Deployment to GitHub Pages

### Method 1: Automatic Deployment (Recommended)

1. **Fork/Create Repository**
   ```bash
   # Push code to your GitHub repo
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**
   - Go to repository **Settings**
   - Click **Pages** in left sidebar
   - Under **Source**, select **GitHub Actions**
   - The workflow will automatically deploy on every push

3. **Update vite.config.ts** (if needed)
   ```typescript
   base: '/YOUR_REPO_NAME/',
   ```

### Method 2: Manual Deployment

```bash
# Build the project
npm run build

# Deploy dist folder to gh-pages branch
npm install -g gh-pages
gh-pages -d dist
```

## 💰 AdMob Integration

This app is pre-configured with ad placements. To enable real ads:

### 1. Create AdMob Account
- Go to [AdMob](https://apps.admob.com)
- Create a new app
- Generate ad unit IDs

### 2. Update Ad Unit IDs

**Banner Ads** - `src/components/ads/BannerAd.tsx`
```tsx
unitId="ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy"
```

**Interstitial Ads** - `src/components/ads/RewardedAd.tsx`
```tsx
unitId="ca-app-pub-xxxxxxxxxxxxxxxx/wwwwwwwwww"
```

**Native Ads** - `src/components/ads/NativeAd.tsx`
```tsx
unitId="ca-app-pub-xxxxxxxxxxxxxxxx/zzzzzzzzzz"
```

**Rewarded Ads** - `src/components/ads/RewardedAd.tsx`
```tsx
unitId="ca-app-pub-xxxxxxxxxxxxxxxx/aaaaaaaaaa"
```

### 3. Install AdMob SDK (for React Native)
```bash
npm install @react-native-admob/admob
```

## 📁 Project Structure

```
├── src/
│   ├── components/
│   │   ├── ui/           # shadcn/ui components
│   │   └── ads/          # Ad components
│   │       ├── BannerAd.tsx
│   │       ├── NativeAd.tsx
│   │       └── RewardedAd.tsx
│   ├── App.tsx           # Main app component
│   ├── App.css           # Styles
│   └── main.tsx          # Entry point
├── .github/
│   └── workflows/
│       └── deploy.yml    # GitHub Actions workflow
├── index.html
├── vite.config.ts
├── package.json
└── README.md
```

## 🎯 Ad Placements

| Ad Type | Location | Frequency |
|---------|----------|-----------|
| Banner | Calculator Top | Always |
| Banner | Calculator Bottom | Always |
| Banner | PIN Screen | On entry |
| Banner | Vault Screen | Multiple |
| Native | Vault View | Once |
| Interstitial | Vault Entry | 30% chance |
| Rewarded | Photo Upload | Every 3 uploads |

## 🔒 Privacy

- All photos are stored locally in your browser
- No data is sent to any server
- PIN is stored in localStorage (encrypted in production)

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Made with ❤️ by [Your Name]
