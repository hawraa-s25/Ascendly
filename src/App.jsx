/* Imports */
import './auth.css'
import { Routes, Route, Navigate, useNavigate } from "react-router-dom"
import Signin from "./pages/Signin"
import SignUp from "./pages/SignUp"
import ResetPassword from "./pages/ResetPassword"
import InApp from "./InApp" 
import React from "react"
import { db, auth, provider, storage } from './firebase'
import { 
    signInWithPopup, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendPasswordResetEmail,
    signOut
} from 'firebase/auth'
import { doc, setDoc, getDoc } from "firebase/firestore"


export default function App() {

    /* States */
    const [user, setUser] = React.useState(null)
    const [userInfo, setUserInfo] = React.useState({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        role: ""
    })
    const [status, setStatus] = React.useState({
        action: "",
        loading: false, 
        error: null,
        success: false
    })
    const [showPassword, setShowPassword] = React.useState(false)
    const [showAuthPopup, setShowAuthPopup] = React.useState(false)

    const navigate = useNavigate()

    React.useEffect(() => {
        setStatus({
            action: "auth-check",
            loading: true,
            error: null,
            success: false
        })

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            try {
                if (user) {
                    setUser(user)
                    const userDoc = await getDoc(doc(db, "users", user.uid))

                    if (userDoc.exists()) {
                        setUserInfo({
                            email: user.email,
                            firstName: userDoc.data().firstName,
                            lastName: userDoc.data().lastName,
                            role: userDoc.data().role
                        })
                    }

                    setStatus({
                        action: "auth-check",
                        loading: false,
                        error: null,
                        success: true
                    })

                    navigate("/app/profile")
                }
                else {
                    resetData()
                    setStatus({
                        action: "auth-check",
                        loading: false,
                        error: null,
                        success: true
                    })
                }
            } catch (err) {
                setStatus({
                    action: "auth-check",
                    loading: false,
                    error: "Failed to load user data",
                    success: false
                })
            }
        })
        return () => unsubscribe()
    }, [])


    function triggerAuthPopup() {
        if (!showAuthPopup) {
            setShowAuthPopup(true)
        }
        setShowAuthPopup(true)
    }

    function closeAuthPopup() {
        setShowAuthPopup(false)
    }

    function resetData(){
        setUser(null)
        setUserInfo({
            email: "",
            password: "",
            firstName: "",
            lastName: ""
        })
    }

    function resetStatus(){
        setStatus({
            action: "",
            loading: false, 
            error: null,
            success: false
        })
    }

    function toggleShowPassword(){
        setShowPassword(prevType => !prevType)
    }

    function isStrongPassword(password) {
        const regex = /^(?=.*[\d!@#$%^&*]).{8,}$/
        return regex.test(password)
    }

    /* Authentication Functions */
    function createAccount() {
        if (!isStrongPassword(userInfo.password)) {
            setStatus({
                action: "signup",
                loading: false,
                error: "Password must be at least 8 characters and include at least one number or special character.",
                success: false
            })
            return
        }

        setStatus({
            action: "signup",
            loading: true, 
            error: null,
            success: false
        })

        createUserWithEmailAndPassword(auth, userInfo.email, userInfo.password)
        .then(async (currentUser) => {

            const userData = {
                email: userInfo.email,
                firstName: userInfo.firstName,
                lastName: userInfo.lastName,
                role: userInfo.role || ""
            }
            await setDoc(doc(db, "users", currentUser.user.uid), userData)
            setUser(currentUser.user)
            setUserInfo(userData)

            setStatus({
                action: "signup",
                loading: false, 
                error: null,
                success: true
            })

            console.log("Account created successfully")
        }).catch((error) => {
            setStatus({
                action: "signup",
                loading: false, 
                error: error.message,
                success: false
            })
            console.error("Error occurred: ", error.message)
        })
    }


    function getEmail(value){
        setUserInfo(prevInfo=>({
            ...prevInfo,
            email: value
        }))
        resetStatus()
    }

    function getPassword(value){
        setUserInfo(prevInfo => ({
            ...prevInfo,
            password: value
        }))

        if (value && !isStrongPassword(value)) {
            setStatus(prev => ({
                ...prev,
                error: "Password must be at least 8 characters and include at least one number or special character."
            }))
        } else {
            resetStatus()
        }
    }


    function getFirstName(value){
        setUserInfo(prevInfo=>({
            ...prevInfo,
            firstName: value
        }))
        console.log("getFirstName",userInfo)
    }

    function getLastName(value){
        setUserInfo(prevInfo=>({
            ...prevInfo,
            lastName: value
        }))
        console.log("getLastName",userInfo)
    }

    function signWithEmailAndPassword(){

        setStatus({
            action: "signin",
            loading: true, 
            error: null,
            success: false
        })

        signInWithEmailAndPassword(auth, userInfo.email, userInfo.password)
        .then((currentUser)=>{

            setStatus({
                action: "signin",
                loading: false, 
                error: null,
                success: true
            })

            setUser(currentUser.user)
            console.log("Signed in successfully")

        }).catch((error)=>{

            setStatus({
                action: "signin",
                loading: false, 
                error: error.message,
                success: false
            })

            console.error("Error occurred: ",error.message)
        })
    }

    function signInWithGoogle() {
        setStatus({
            action: "google-signin",
            loading: true,
            error: null,
            success: false
        })

        signInWithPopup(auth, provider)
        .then(async (currentUser) => {
            const user = currentUser.user
            const userDoc = await getDoc(doc(db, "users", user.uid))
            
            if (!userDoc.exists()) {

                const displayName = user.displayName || ""
                const nameParts = displayName.split(" ")
                const firstName = nameParts[0] || ""
                const lastName = nameParts.slice(1).join(" ") || ""

                const userData = {
                    email: user.email,
                    firstName: firstName,
                    lastName: lastName,
                    role: "",
                }
                await setDoc(doc(db, "users", user.uid), userData)

                setUserInfo(userData)
            } else {
                setUserInfo(userDoc.data())
            }

            setUser(user)
            
            setStatus({
                action: "google-signin",
                loading: false,
                error: null,
                success: true
            })
            
            console.log("Signed in with Google successfully")
        }).catch((error) => {
            setStatus({
                action: "google-signin",
                loading: false,
                error: error.message,
                success: false
            })
            console.error("Error occurred: ", error.message)
        })
    }

    function resetPassword(){

        setStatus({
            action: "reset",
            loading: true,
            error: null,
            success: false
        })

        sendPasswordResetEmail(auth, userInfo.email)
        .then(()=>{

            setStatus({
                action: "reset",
                loading: false,
                error: null,
                success: true,
            }) 
            console.log("Password reset email sent successfully")

        }).catch((error)=>{

            setStatus({
                action: "reset",
                loading: false,
                error: error.message,
                success: false
            })
            console.error("Error occurred: ",error.message)
        })

    }

    function handleSignOut(){

        setStatus({
            action: "signout",
            loading: true, 
            error: null,
            success: false
        })

        signOut(auth)
        .then(()=>{

            setStatus({
                action: "signout",
                loading: false, 
                error: null,
                success: true
            })

            setUser(null)
            console.log("Signed out successfully")
        }).catch((error)=>{

            setStatus({
                action: "signout",
                loading: false, 
                error: error.message,
                success: false
            })

            console.error("Error occurred: ",error.message)
        })

    }

    function LoadingSpinner() {
        return (
            <div className="full-page-loading">
                <div className="loading-spinner-container">
                    <div className="app-spinner-large"></div>
                    <p>Loading Ascendly...</p>
                </div>
            </div>
        )
    }

    if (status.action === "auth-check" && status.loading) {
        return <LoadingSpinner />
    }

    if (status.action === "auth-check" && status.error) {
        return (
            <div className="full-page-loading">
                <div className="loading-spinner-container error">
                    <p className="error-message">{status.error}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="retry-button"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }


    return (
        <>
        {!user && showAuthPopup && (
        <div className="overlay">
            <div className="auth-popup-card">  
                <div className='back'>
                    <button onClick={() => closeAuthPopup()} className='overlay-back-btn'>x</button>
                </div>                  
                <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 28" fill="none" stroke="#7FB69E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock w-8 h-8 text-primary" aria-hidden="true">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <h3>Sign In Required</h3>
                <p>You need to sign in to access that feature. Join our community to unlock all features.</p>
                <button onClick={() => { closeAuthPopup(); navigate("/signin") }} id='popup-signin'>
                    Sign in
                </button>
                <button onClick={() => { closeAuthPopup(); navigate("/signup") }} id='popup-signup'>
                    Create account
                </button>
            </div>
        </div>
        )}
        <Routes>
            <Route path="/" element={<Navigate to={user ? "/app/profile" : "/app/blogs"} />} />
            <Route path="/signin" element={
                <Signin 
                    googleOnClick={signInWithGoogle}
                    onEmailChange={getEmail}
                    onPasswordChange={getPassword}
                    signInOnClick={signWithEmailAndPassword}
                    resetOnClick={resetPassword}
                    hidePasswordOnClick={toggleShowPassword}
                    showPassword={showPassword}
                    status={status}
                />
            } />
            <Route path="/signup" element={
                <SignUp 
                    user={user} 
                    status={status}
                    googleOnClick={signInWithGoogle}
                    onEmailChange={getEmail}
                    onPasswordChange={getPassword}
                    onFirstNameChange={getFirstName}
                    onLastNameChange={getLastName}
                    hidePasswordOnClick={toggleShowPassword}
                    showPassword={showPassword}
                    createAccountOnClick={createAccount}
                    userInfo={userInfo}
                    setUserInfo={setUserInfo}
                    />
            } />

            <Route path="/reset-password" element={
                <ResetPassword
                    status={status}
                    onEmailChange={getEmail}
                    resetOnClick={resetPassword} 
                />} />
            <Route path="/app/*" element={
                <InApp 
                    status={status}
                    setStatus={setStatus}
                    signOutOnClick={handleSignOut} 
                    userInfo={userInfo}
                    triggerAuthPopup={triggerAuthPopup}
                    user={user}
                /> } 
            />
        </Routes>
        </>
    )
}
