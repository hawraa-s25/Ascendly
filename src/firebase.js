import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth, GoogleAuthProvider } from "firebase/auth"
import { getStorage } from "firebase/storage"
import { getDatabase } from "firebase/database"

const firebaseConfig = {
  apiKey: "AIzaSyA-cmt-6nEhkFp90Pjq5N7TzxLWHjSiY7s",
  authDomain: "ascendlygrad.firebaseapp.com",
  projectId: "ascendlygrad",
  storageBucket: "ascendlygrad.firebasestorage.app",
  messagingSenderId: "1024622385350",
  appId: "1:1024622385350:web:03ccbbb12f416ac10b5fc7"
}

// Initialize Firebase (keep this for auth/storage)
const app = initializeApp(firebaseConfig)

// Services (keep these for Firebase Auth/Storage)
const db = getFirestore(app)
const auth = getAuth(app)
const provider = new GoogleAuthProvider()
const storage = getStorage(app)
const realTimeDB = getDatabase()

// REMOVED: All Functions-related code
// REMOVED: getFunctions, connectFunctionsEmulator, httpsCallable

// NEW: Vercel API functions
export const summarizedBlog = async (content) => {
  const response = await fetch('/api/summarizedBlog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }) // This is correct
  })
  return response.json()
}

export const createEmbeddings = async (text) => {
  const response = await fetch('/api/createEmbeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }) // This sends { text: "your text" }
  })
  return response.json() // This returns { embedding: [...] }
}

export const extractData = async (fileData) => {
  const response = await fetch('/api/extractData', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileData })
  })
  return response.json()
}


// Exports (removed functions)
export { app, db, auth, provider, storage, realTimeDB }







// Enable emulator in development mode
/*if (location.hostname === "localhost") {
  // Firebase emulator default port for functions is 5001
  connectFunctionsEmulator(functions, "localhost", 5001)
}

// Callable function
export const summarizedBlog = httpsCallable(functions, "summarizedBlog")
export const extractData = httpsCallable(functions, "extractData")
export const createEmbeddings = httpsCallable(functions, "createEmbeddings")*/

// // src/firebase.js
// import { initializeApp } from "firebase/app"
// import { getFirestore } from "firebase/firestore"
// import {getAuth, GoogleAuthProvider } from "firebase/auth"
// import { getStorage} from "firebase/storage"
// import { getFunctions, httpsCallable } from "firebase/functions"

// const firebaseConfig = {
//   apiKey: "AIzaSyA-cmt-6nEhkFp90Pjq5N7TzxLWHjSiY7s",
//   authDomain: "ascendlygrad.firebaseapp.com",
//   projectId: "ascendlygrad",
//   storageBucket: "ascendlygrad.firebasestorage.app",
//   messagingSenderId: "1024622385350",
//   appId: "1:1024622385350:web:03ccbbb12f416ac10b5fc7"
// }

// const app = initializeApp(firebaseConfig)
// const db = getFirestore(app)
// const auth = getAuth(app)
// const provider = new GoogleAuthProvider()
// const storage=getStorage()
// const functions = getFunctions(app)
// export const summarizedBlog = httpsCallable(functions, "summarizedBlog")

// export { app, db, auth, provider, storage, functions }



/**
 * 
 * Make sure you have initialized the emulator first:

bash
Copy
Edit
firebase init emulators
And start it:

bash
Copy
Edit
firebase emulators:start --only functions
 */

/**
 * 
 * 
 * 
 * if (location.hostname === "localhost") {
  connectFunctionsEmulator(functions, "localhost", 5001)
}

 */
