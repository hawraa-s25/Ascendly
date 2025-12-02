import Blogs from "./pages/Blogs"
import Jobs from "./pages/Jobs"
import Profile from "./pages/Profile"
import Chats from "./pages/Chats"
import RecommendedJobs from "./pages/RecommendedJobs"
import BrowseProfiles from "./pages/BrowseProfiles"
import { db, auth, storage } from './firebase'
import { Routes, Route, Link, NavLink, useNavigate, Outlet } from "react-router-dom"
import React from "react"
import { doc, getDoc } from "firebase/firestore"
import logo from "./ascendly-logo.png"

export default function InApp(props){

    const [resumeText, setResumeText] = React.useState("")
    const [allProfiles, setAllProfiles] = React.useState([])
    const [menuOpen, setMenuOpen] = React.useState(false)
    const navigate = useNavigate()

    const closeMobileMenu = () => {
        setMenuOpen(false)
    }

    React.useEffect(() => {
        async function loadResumeText() {
            if (!auth.currentUser) return

            props.setStatus(prev => ({
                ...prev,
                action: "load-resume",
                loading: true,
                error: null,
                success: false
            }))

            if (auth.currentUser) {
                try {
                    const profileRef = doc(db, "profile", auth.currentUser.uid)
                    const snapshot = await getDoc(profileRef)
                    if (snapshot.exists()) {
                        const data = snapshot.data()
                        setResumeText(data.resumeText || "")
                        console.log("Resume text loaded from Firestore:", data.resumeText ? `${data.resumeText.length} characters` : "empty")
                    }

                    props.setStatus(prev => ({
                        ...prev,
                        action: "load-resume",
                        loading: false,
                        error: null,
                        success: true
                    }))

                } catch (error) {
                    console.error("Error loading resume text:", error)

                    props.setStatus(prev => ({
                        ...prev,
                        action: "load-resume",
                        loading: false,
                        error: "Could not load resume text",
                        success: false
                    }))
                }
            }
        }
        
        loadResumeText()
    }, [auth.currentUser])
    
    return (
        <>
        <nav className="navBar">
            <img src={logo} alt="Ascendly Logo"/>
            
            {window.innerWidth <= 767 && <button 
                className="mobile-menu-toggle" 
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
                {menuOpen ? '✕' : '☰'}
            </button>}
            
            <div className={`navItem ${menuOpen ? 'active' : ''}`}>
                <NavLink 
                    to="/app/blogs" 
                    className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                    onClick={closeMobileMenu}
                >
                    Blogs
                </NavLink>
                <NavLink 
                    to="/app/jobs" 
                    className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                    onClick={closeMobileMenu}
                >
                    Jobs
                </NavLink>
                {props.user ? (
                    <>
                        <NavLink 
                            to="/app/profile" 
                            className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                            onClick={closeMobileMenu}
                        >
                            Profile
                        </NavLink>
                        <NavLink 
                            to="/app/chats" 
                            className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                            onClick={closeMobileMenu}
                        >
                            Chats
                        </NavLink>
                    </>
                ) : (
                    <>
                        <span 
                            className="nav-link" 
                            onClick={() => {
                                props.triggerAuthPopup()
                                closeMobileMenu()
                            }}
                        >
                            Profile
                        </span>
                        <span 
                            className="nav-link" 
                            onClick={() => {
                                props.triggerAuthPopup()
                                closeMobileMenu()
                            }}
                        >
                            Chats
                        </span>
                    </>
                )}
            </div>
            
            {/* Sign in/out button */}
            {auth.currentUser ? (
                <button 
                    className="sign-out-btn" 
                    onClick={() => {
                        props.signOutOnClick()
                        navigate("/app/blogs")
                        closeMobileMenu()
                    }}
                >
                    Sign Out
                </button>
            ) : (
                <button 
                    className="sign-out-btn" 
                    onClick={() => {
                        navigate("/signin")
                        closeMobileMenu()
                    }}
                >
                    Sign In
                </button>
            )}
        </nav>
        
        {menuOpen && (
            <div 
                className="mobile-menu-overlay"
                onClick={closeMobileMenu}
            />
        )}

        <Routes>
            <Route path="blogs" element={
                <Blogs 
                    db={db}
                    auth={auth} 
                    storage={storage} 
                    userInfo={props.userInfo}
                    allProfiles={allProfiles}
                    triggerAuthPopup={props.triggerAuthPopup}
                    status={props.status}
                    setStatus={props.setStatus}
                />
            }/>
            <Route path="jobs/*" element={
                <Jobs 
                    db={db} 
                    auth={auth} 
                    storage={storage} 
                    userInfo={props.userInfo}
                    resumeText={resumeText}
                    allProfiles={allProfiles}
                    triggerAuthPopup={props.triggerAuthPopup}
                    status={props.status}
                    setStatus={props.setStatus}
                />
            }>
                <Route path="recommended" element={<RecommendedJobs/>} />
            </Route>
            <Route path="profile/*" element={
                <Profile 
                    auth={auth}
                    storage={storage}
                    setResumeText={setResumeText}
                    setAllProfiles={setAllProfiles}
                    allProfiles={allProfiles}
                    userInfo={props.userInfo}
                    status={props.status}
                    setStatus={props.setStatus}
                />
            }>
                <Route path="browse" element={<BrowseProfiles/>} />
            </Route>
            <Route path="chats" element={
                <Chats 
                    auth={auth}
                    storage={storage}    
                    allProfiles={allProfiles}
                    userInfo={props.userInfo}
                    status={props.status}
                    setStatus={props.setStatus}
                />
            }/>
        </Routes>

        {props.status.loading && props.status.action==="signout" && <p>Signing out...</p>}
        {props.status.error && props.status.action==="signout" && <p>{props.status.error}</p>}
        </>
    )
}
