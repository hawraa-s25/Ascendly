import { Link, useNavigate } from "react-router-dom"
import logo from "../ascendly-logo.png"
import StatusPopup from "./StatusPopup"
import React from "react"

export default function ResetPassword(props){
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
        if (props.status.action === "reset") {
            if (props.status.loading) {
                showStatus("Sending reset instructions...", "loading")
            } else if (props.status.error) {
                showStatus(props.status.error, "error")
            } else if (props.status.success && !props.status.error) {
                showStatus("Reset email sent successfully! Check your inbox.", "success")
            }
        }
    }, [props.status])


    async function handleResetPassword() {
        showStatus("Sending reset instructions...", "loading")
        try {
            await props.resetOnClick()
        } catch (error) {
            console.warn(error.message)
        }
    }

    return (
        <div className="container">

            <StatusPopup statusPopup={statusPopup} onClose={hideStatus} />
            
            <div className="rightSide">
                <img src={logo} alt="Ascendly Logo"/>
                <h1>Reset your password securely now</h1>
                <p>We'll send you instructions to reset your password and get you back on track.</p>
            </div>
            <div className="SignUp">
                <button 
                    onClick={()=>navigate("/signin")} 
                    className="back-sign-in"
                    disabled={statusPopup.type === "loading"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-left w-4 h-4 mr-2" aria-hidden="true">
                        <path d="m12 19-7-7 7-7"></path>
                        <path d="M19 12H5"></path>
                    </svg>
                    Back to sign in
                </button>
                <h2>Reset Password</h2>
                <p>Enter your email address and we'll send you instructions to reset your password</p>
                
                <div className="email-password">
                    <label htmlFor="email-input">Email Address</label>
                    <input 
                        className="email-input" 
                        type="email" 
                        placeholder="you@example.com" 
                        onChange={(e) => props.onEmailChange(e.target.value)}
                        required
                        disabled={statusPopup.type === "loading"}
                    />
                </div>
                    

                <button 
                    onClick={handleResetPassword} 
                    id="reset-pass-btn"
                    disabled={statusPopup.type === "loading"}
                >
                    {statusPopup.type === "loading" ? (
                        <span className="button-loading">
                            <div className="spinner"></div>
                            Sending...
                        </span>
                    ) : "Reset Password"}
                </button>
            </div>
        </div>
    )
}
