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

In the Rules Tab on firebase add this ruleset

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // EVERYTHING under /business is allowed for any logged-in user (including anonymous)
    match /business/{any=**} {
      allow read, write: if request.auth != null;
    }

    // Deny everything else in the entire project
    match /{document=**} {
      allow read, write: if false;
    }
  }
}

4. make a copy of this file
    rename it to firebaseConfig.js
    paste your config at after these instuctions:
    replacing the existing:

    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "your-project.firebaseapp.com",
        projectId: "your-project",
        storageBucket: "your-project.appspot.com",
        messagingSenderId: "123456789",
        appId: "1:123456789:web:abc123def456"
    };

        Save and open index.html in your Browser
        log in with your player name you should be promoted to manager

        If you are not then do the following:
        
        Ctrl + Shift + I or F12 to open the browser console
        type claimManager(); in the console

        → Click OK on the confirm box
        → Page reloads automatically
        → You are now permanent Manager

        All players open the same HTML file
        Everyone sees the same warehouse, orders, prices
        Changes appear instantly
        Works offline and syncs when back online 
*/

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123def456"
};

// 1) make a copy of this file
// 2) replace the above config with your own config
// 3) save as firebaseConfig.js
// 4) open index.html

