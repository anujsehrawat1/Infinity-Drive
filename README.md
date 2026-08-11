# Infinity Drive 🌌

A next-generation, **vibe-coded** personal cloud storage application that provides unlimited storage by leveraging Telegram's infrastructure and Firebase for seamless state management. 

## 🚀 How it works

Infinity Drive is a fully decentralized-feeling drive. Under the hood, it dynamically provisions a private, muted, and archived Telegram channel just for you (named `InfinityDrive Storage`). This channel acts as a bottomless bit-bucket for all your files. The metadata—what your files are named, how big they are, and where their pieces are scattered across the Telegram network—is carefully organized and tracked using Firebase Realtime Database. 

Your data remains yours. The app serves as a slick, high-performance bridge between you and your limitless storage.

## 🤯 Bypassing the Limits

Ever tried sending a huge file on Telegram and got blocked? We solved that.

### Bypassing the 50MB Bot Limit
Standard Telegram bots are capped at a measly 50MB per upload. Infinity Drive bypasses this entirely by using the core MTProto API (via GramJS) directly in the browser as a user client. By acting as a true user client, it unlocks Telegram's premium 2GB upload tier for *any* standard user.

### Bypassing the 2GB Absolute Limit
What if your file is a massive 10GB 4K video? Infinity Drive doesn't flinch. 
Our custom `storageEngine` intercepts massive files and surgically slices them into optimized ~1.9GB chunks. It then blasts these chunks to Telegram in parallel (using 6 concurrent worker streams to maximize bandwidth and prevent MTProto socket buffer bloat). When you download the file, the engine fetches all the chunks seamlessly and recombines them in-memory before serving the pristine original file back to you.

## 🛠️ Tech Stack & Architecture
* **Frontend:** React, Vite, TailwindCSS (Vibe-coded for aesthetic perfection)
* **Storage Engine:** Telegram MTProto API (`telegram` package)
* **Database & Metadata:** Firebase Realtime Database
* **Authentication:** Telegram Phone/OTP Auth

## 🔧 Setup

1. Clone the repository.
2. Install dependencies: `npm install`
3. Create a `.env` file in the root directory (use the `.env.example` as a template or configure your own Firebase and Telegram API keys).
4. Run the development server: `npm run dev`

**Enjoy your unlimited universe of storage!** 🚀
