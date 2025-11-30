import { Link, useNavigate } from "react-router-dom"
import logo from "../ascendly-logo.png"
import StatusPopup from "./StatusPopup"
import React from "react"

export default function Signin(props){

    const navigate = useNavigate()
    const [statusPopup, setStatusPopup] = React.useState({
        show: false,
        message: "",
        type: "" 
    })

    React.useEffect(() => {
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

    React.useEffect(() => {
        if (props.status.action === "signin") {
            if (props.status.loading) {
                showStatus("Signing in...", "loading")
            } else if (props.status.error) {
                showStatus(props.status.error, "error")
            } else if (props.status.success) {
                showStatus("Signed in successfully!", "success")
            }
        }
    }, [props.status])

    async function handleGoogleSignIn() {
        showStatus("Signing in with Google...", "loading")
        try {
            await props.googleOnClick()
            showStatus("Signed in with Google successfully!", "success")
        } catch (error) {
            showStatus("Failed to sign in with Google", "error")
        }
    }

    async function handleEmailSignIn() {
        showStatus("Signing in...", "loading")
        try {
            await props.signInOnClick()
        } catch (error) {
            console.warn(error.message)
        }
    }

    return(
        <div className="container">

            <StatusPopup statusPopup={statusPopup} onClose={hideStatus} />
            
            <div className="rightSide">
                <img src={logo} alt="Ascendly Logo"/>
                <h1>Welcome back to your career journey</h1>
                <p>Connect with opportunities, grow your network, and advance your career.</p>
            </div>
            <div className="Signin">

                <h2>Sign In</h2>

                <button 
                    id="google" 
                    onClick={handleGoogleSignIn}
                    disabled={statusPopup.type === "loading"}
                >
                    <img src="src/assets/images/GoogleLogo.png" alt="Google logo"/>
                    {statusPopup.type === "loading" && statusPopup.message.includes("Google") ? (
                        <span className="button-loading">
                            <div className="spinner"></div>
                            Signing in...
                        </span>
                    ) : "Sign in with Google"}
                </button>

                <p>Or sign in with email and password</p>

                <div id="inputs">
                    <div className="input-group">
                        <label htmlFor="email-input">Email</label>
                        <input 
                            id="email-input" 
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
                
                <Link 
                    to="/reset-password" 
                    className="reset-pass-link"
                    style={{ pointerEvents: statusPopup.type === "loading" ? "none" : "auto", opacity: statusPopup.type === "loading" ? 0.5 : 1 }}
                >
                    Forgot password?
                </Link>

                <button 
                    className="sign-in-btn" 
                    onClick={handleEmailSignIn}
                    disabled={statusPopup.type === "loading"}
                >
                    {statusPopup.type === "loading" && statusPopup.message === "Signing in..." ? (
                        <span className="button-loading">
                            <div className="spinner"></div>
                            Signing in...
                        </span>
                    ) : "Sign in"}
                </button>

                <div className="sign-up-text">
                    <span>Don't have an account</span>
                </div>

                <button 
                    onClick={()=>navigate("/signUp")} 
                    className="sign-up-btn"
                    disabled={statusPopup.type === "loading"}
                >
                    Create An Account
                </button>
            </div>
        </div>
    )
}