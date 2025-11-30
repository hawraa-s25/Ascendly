import { Link, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import logo from "../ascendly-logo.png"
import StatusPopup from "./StatusPopup"

export default function SignUp(props) {

    const navigate = useNavigate()
    const [statusPopup, setStatusPopup] = useState({
        show: false,
        message: "",
        type: "" 
    })
    useEffect(() => {
        if (statusPopup.show && statusPopup.type !== "loading") {
            const timer = setTimeout(() => {
                setStatusPopup({ show: false, message: "", type: "" })
            }, statusPopup.type === "error" ? 5000 : 3000)
            
            return () => clearTimeout(timer)
        }
    }, [statusPopup])

    const showStatus = (message, type = "loading") => {
        setStatusPopup({ show: true, message, type })
    }

    const hideStatus = () => {
        setStatusPopup({ show: false, message: "", type: "" })
    }

    useEffect(() => {
        if (props.status.action === "signup") {
            if (props.status.loading) {
                showStatus("Creating your account...", "loading")
            } else if (props.status.error) {
                showStatus(props.status.error, "error")
            } else if (props.status.success) {
                showStatus("Account created successfully!", "success")
            }
        }
    }, [props.status])

    async function handleGoogleSignUp() {
        showStatus("Signing up with Google...", "loading")
        try {
            await props.googleOnClick()
            showStatus("Signed up with Google successfully!", "success")
        } catch (error) {
            showStatus("Failed to sign up with Google", "error")
        }
    }

    async function handleCreateAccount() {
        if (!props.userInfo.firstName || !props.userInfo.lastName || !props.userInfo.email || !props.userInfo.password) {
            showStatus("Please fill in all required fields", "error")
            return
        }

        if (!props.userInfo.role) {
            showStatus("Please select your role", "error")
            return
        }

        showStatus("Creating your account...", "loading")
        try {
            await props.createAccountOnClick()
        } catch (error) {
            console.warn(error.message)
        }
    }

    return (
        <div className="container">

            <StatusPopup statusPopup={statusPopup} onClose={hideStatus} />
            
            <div className="wave">
                 <svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 120" >
                    <path 
                        fill="#ffe4c4"
                        d="M985.66,92.83C906.67,72,823.78,31,743.84,14.19c-82.26-17.34-168.06-16.33-250.45.39-57.84,11.73-114,31.07-172,41.86A600.21,600.21,0,0,1,0,27.35V120H1200V95.8C1132.19,118.92,1055.71,111.31,985.66,92.83Z">
                    </path>
                </svg>
            </div>
            <div className="rightSide">
                <img src={logo} alt="Ascendly Logo"/>
                <h1>Start your journey to success</h1>
                <p>Join professionals finding their dream jobs and top talent</p>
                <div className="feature">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="#2B3142" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    <div className="feature-text">
                        <h3>AI-Powered Matching</h3>
                        <p>Get personalized job recommendations based on your skills</p>
                    </div>  
                </div>
                <div className="feature">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="#2B3142" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    <div className="feature-text">
                        <h3>Direct Communication</h3>
                        <p>Connect directly with recruiters and candidates</p>
                    </div>                   
                </div>
                <div className="feature">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="#2B3142" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    <div className="feature-text">
                        <h3>Career Resources</h3>
                        <p>Access blogs, insights, and career development tips</p>                        
                    </div>
                </div>
            </div>
            <div className="SignUp">
                <h2>Join Ascendly</h2>
                <p>Join our community and start your journey today</p>
                
                <button 
                    id="google" 
                    onClick={handleGoogleSignUp} 
                    type="button"
                    disabled={statusPopup.type === "loading"}
                >
                    <img src="src/assets/images/GoogleLogo.png" alt="Google logo" />
                    {statusPopup.type === "loading" && statusPopup.message.includes("Google") ? (
                        <span className="button-loading">
                            <div className="spinner"></div>
                            Signing up...
                        </span>
                    ) : "Sign up with Google"}
                </button>

                <div id="inputs">
                    <div id="user-name">
                        <div className="name-input">
                            <label htmlFor="first-name">First Name</label>
                            <input
                                id="first-name" 
                                type="text"
                                placeholder="John"
                                onChange={(e) => props.onFirstNameChange(e.target.value)}
                                disabled={statusPopup.type === "loading"}
                                required
                            />
                        </div>

                        <div className="name-input">
                            <label htmlFor="last-name">Last Name</label>
                            <input
                                id="last-name"
                                type="text"
                                placeholder="Doe"
                                onChange={(e) => props.onLastNameChange(e.target.value)}
                                disabled={statusPopup.type === "loading"}
                                required
                            />
                        </div>
                    </div>

                    <div id="credentials">
                        <div className="input-group">
                            <label htmlFor="email-input">Email</label>
                            <input 
                                className="email-input" 
                                type="email" 
                                placeholder="Email" 
                                onChange={(e) => props.onEmailChange(e.target.value)}
                                required
                                disabled={statusPopup.type === "loading"}
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="password-input">Password</label>
                            <div className="password-view">
                                <input 
                                    id="password-input" 
                                    type={props.showPassword ? "text" : "password"}
                                    placeholder="Password" 
                                    onChange={(e) => props.onPasswordChange(e.target.value)}
                                    required
                                    disabled={statusPopup.type === "loading"}
                                />
                                <span 
                                    id="toggle-password" 
                                    onClick={props.hidePasswordOnClick}
                                    style={{ opacity: statusPopup.type === "loading" ? 0.5 : 1 }}
                                >
                                    {props.showPassword ? "Hide" : "Show"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <p>I am a:</p>
                <div className="userType-option">
                    <label className="custom-radio">
                        <input 
                            type="radio"
                            className="job-seeker-option" 
                            checked={props.userInfo.role==="jobseeker"}
                            onChange={()=>props.setUserInfo({...props.userInfo, role:"jobseeker"})}
                            disabled={statusPopup.type === "loading"}
                        />
                        <span>Job Seeker</span>
                    </label>

                    <label className="custom-radio">
                        <input 
                            type="radio"
                            className="recruiter-option" 
                            checked={props.userInfo.role==="recruiter"}
                            onChange={()=>props.setUserInfo({...props.userInfo, role:"recruiter"})}
                            disabled={statusPopup.type === "loading"}
                        />
                        <span>Job Recruiter</span>
                    </label>
                </div>

                <button
                    className="sign-in-btn"
                    onClick={handleCreateAccount}
                    type="button"
                    disabled={statusPopup.type === "loading"}
                >
                    {statusPopup.type === "loading" && statusPopup.message === "Creating your account..." ? (
                        <span className="button-loading">
                            <div className="spinner"></div>
                            Creating Account...
                        </span>
                    ) : "Create Account"}
                </button>
                
                <div className="sign-up-text">
                    <span>Already have an account?</span>
                </div>

                <button 
                    onClick={()=>navigate("/signin")} 
                    className="sign-up-btn"
                    disabled={statusPopup.type === "loading"}
                >
                    Sign In
                </button>
            </div>
        </div>
      )
    }