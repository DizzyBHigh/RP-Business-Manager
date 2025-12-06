// Add your firbeas configuration here:
/* 5 - MINUTE SETUP GUIDE(copy - paste ready)
1. Create Firebase project(free)
Go to: https://firebase.google.com
→ “Create project” → name it “HSRP - Manager” → disable Google Analytics → Create
2. Add Firestore Database

In Firebase console → Build → Firestore Database
Click “Create database”
Start in test mode(we’ll secure it in 1 minute)
Choose closest region(e.g.nam5(us - central))

3. Add Web App

Click the web icon </> → App nickname: “HSRP Manager” → Register app
Copy the config(looks like this):

JavaScriptconst firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "hsrp-manager-123.firebaseapp.com",
    projectId: "hsrp-manager-123",
    storageBucket: "hsrp-manager-123.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123def456"
};

4. Add Firebase to your HTML(paste in <head>)
    HTML<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>

    <script>
// REPLACE THIS WITH YOUR FIREBASE CONFIG
        const firebaseConfig = {
            apiKey: "YOUR_API_KEY",
        authDomain: "your-project.firebaseapp.com",
        projectId: "your-project",
        storageBucket: "your-project.appspot.com",
        messagingSenderId: "123456789",
        appId: "1:123456789:web:abc123def456"
};

        Save and open the file in your Browser
        log in with your player name
        ctrl Shift I to open the browser console
        type claimManager();

        → Click OK on the confirm box
        → Page reloads automatically
        → You are now permanent Manager

        The first time you open the app all your local data should be migrated to the database


        All players open the same HTML file
        Everyone sees the same warehouse, orders, prices
        Changes appear instantly
        Works offline and syncs when back online */

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123def456"
};

// 1) make a copy of this file
// 2) add your config
// 3) save as firebaseConfig.js