import React from "react"
import { createEmbeddings } from "../firebase"
import { useNavigate, useOutletContext } from "react-router-dom"
import { updateDoc, doc, query, where, collection, getDocs, onSnapshot, getDoc, setDoc } from "firebase/firestore"
import { cosineSimilarity } from "../commonFunctions"
import defaultImage from "./defaultProfileImage.jpeg"
import StatusPopup from "./StatusPopup"

export default function RecommendedJobs(){
    const { resumeText, allJobs, db, user, jobEmbeddings } = useOutletContext()
    const q = user ? query(collection(db, "profile"), where("userId", "==", user.uid)) : null
    const navigate = useNavigate()

    const [resumeEmbedding, setResumeEmbedding] = React.useState([])
    const [recommendedJobs, setRecommendedJobs] = React.useState([])
    const [fetchedJobs, setFetchedJobs] = React.useState([])
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

    React.useEffect(()=>{
        if (user){
            fetchRecommendedJobs()
        } else{
            showStatus("Please sign in to view recommended jobs", "error")
        }
    },[])

    React.useEffect(()=>{
        if (recommendedJobs.length>0){
            setFetchedJobs(recommendedJobs)
        }
    },[recommendedJobs])

    async function matchResume() {

        if (!user) {
            showStatus("Please sign in to match jobs", "error")
            return
        }

        if (!resumeText) {
            showStatus("Please upload your resume first in your profile", "error")
            return
        }

        showStatus("Analyzing your resume and finding matches...", "loading")
        
        try {
            console.log("Calling function...")
            /*const resumeEmbeddings = await createEmbeddings({
                text: resumeText
            })
            
            console.log("Success for resume:", resumeEmbeddings.data)
            console.log("Success for job:", jobEmbeddings)

            const similarities = allJobs.map((job,index)=>{
                const jobEmbed = jobEmbeddings && jobEmbeddings[index]
                if (!jobEmbed) return null
                return {
                    ...job,
                    score: cosineSimilarity(resumeEmbeddings.data.embedding, jobEmbed)
            }}).filter(Boolean)*/
            const resumeEmbeddings = await createEmbeddings(resumeText) // Remove the wrapper object

            console.log("Success for resume:", resumeEmbeddings)
            console.log("Success for job:", jobEmbeddings)

            // Check if embedding exists in the response
            if (!resumeEmbeddings || !resumeEmbeddings.embedding) {
                throw new Error("No embedding generated for resume")
            }

            const similarities = allJobs.map((job,index)=>{
                const jobEmbed = jobEmbeddings && jobEmbeddings[index]
                if (!jobEmbed) return null
                return {
                    ...job,
                    score: cosineSimilarity(resumeEmbeddings.embedding, jobEmbed) // Remove .data
            }}).filter(Boolean)
            similarities.sort((a,b)=> b.score - a.score)
            const topJobs = similarities.slice(0,10)

            setResumeEmbedding(resumeEmbeddings.embedding)
            setRecommendedJobs(topJobs)
            await addRecommendedJobsToDB(topJobs)
            showStatus(`Found ${topJobs.length} job matches!`, "success")
        } catch (error) {
            console.error("Full error:", error.message)
            
            let errorMessage = "Failed to match jobs"
            if (error.code === 'unavailable') {
                errorMessage = "Network error. Please check your connection"
            } else if (error.message?.includes('resume')) {
                errorMessage = "Please upload your resume first in your profile"
            }
            
            showStatus(errorMessage, "error")
        }
    }

    async function addRecommendedJobsToDB(jobs){
        if (!user) return
        const profileRef = doc(db, "profile", user.uid)
        try {
            await setDoc(profileRef, { recommendedJobs: jobs }, { merge: true })
            console.log("Recommended jobs saved successfully")
        } catch(err) {
            console.error("Failed to save recommended jobs:", err)
        }
    }

    async function fetchRecommendedJobs(){
        if (!user) return
        showStatus("Loading your job matches...", "loading")
        try {
            const profileRef = doc(db, "profile", user.uid)
            const snapshot = await getDoc(profileRef)
            if (snapshot.exists()) {
                const data = snapshot.data()
                const fetchedJobs = data.recommendedJobs || []
                setFetchedJobs(fetchedJobs)
                console.log("Fetched jobs:", fetchedJobs)
                if (fetchedJobs.length > 0) {
                    showStatus("Your job matches loaded successfully!", "success")
                } else {
                    hideStatus() 
                }
            } else {
                hideStatus() 
            }
        } catch (error) {
            console.error("Failed to load recommended jobs:", error)
            showStatus("Failed to load your job matches", "error")
        }
    }

    return(
        <>
            <StatusPopup 
                statusPopup={statusPopup} 
                onClose={hideStatus}
            />
            
            <div className="bodyContent">
                <div className="textContent">
                    <h2>AI-Powered Job Matching</h2>
                    <p>Discover personalized job recommendations based on your resume</p>
                </div>
                <button onClick={()=>navigate("/app/jobs")} className="back-to-jobs">Back to Jobs</button>
            </div>
            {fetchedJobs.length > 0 ? <>
            <div className="recommended-header">
                <h3>Your Matches</h3>
                <button 
                    className="match-btn" 
                    onClick={matchResume}
                    disabled={statusPopup.type === "loading"}
                >
                    {statusPopup.type === "loading" ? (
                        <span className="button-loading">
                            <div className="spinner"></div>
                            Matching...
                        </span>
                    ) : "Match Again"}
                </button>
            </div>

            <div className="recommended-list">
                {fetchedJobs.map((jobObj, index) => (
                    <article key={jobObj.id || index} className="job-card">
                        <div className="profile-details">
                            <img src={jobObj.createdBy.profileURL || defaultImage} alt="Company logo"/>
                            <p className="job-author">{jobObj.createdBy.firstName || 'Unknown'} {jobObj.createdBy.lastName || ''}</p>
                        </div>
                        <h2 className="job-title">{jobObj.title}</h2>
                        <p className="job-description">{jobObj.description}</p>
                        <span>Requirements:</span>
                        <ul className="requirement-list">
                            {jobObj.requirements.map((requirement) => (
                                <li key={requirement}>{requirement}</li>
                            ))}
                        </ul>
                        {jobObj.location && <p className="svg-content">
                            <svg xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                width="20" height="20"
                                fill="none"
                                stroke="#7FB69E"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="icon icon-location">
                            <path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 1118 0z"></path>
                            <circle cx="12" cy="10" r="2.5"></circle>
                            </svg> 
                            {jobObj.location}</p>
                        }
                        {jobObj.jobType && <p className="svg-content">
                            <svg xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                width="20" height="20"
                                fill="none"
                                stroke="#7FB69E"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="icon icon-briefcase">
                            <rect x="2" y="7" width="20" height="13" rx="2" ry="2"></rect>
                            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path>
                            <path d="M2 13h20"></path>
                            </svg>
                            {jobObj.jobType}</p>
                        }
                        {jobObj.applicationURL && <p className="application-link"><span>Apply here:</span> <a href={`${jobObj.applicationURL}`} target="_blank" rel="noopener noreferrer">{jobObj.applicationURL}</a></p>}
                        <p className="job-score">Match Score: {(jobObj.score * 100).toFixed(0)}%</p>
                    </article>
                ))}
            </div></> 
                :
            <div className="match-container">
                <h3>
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" 
                            fill="none" stroke="currentColor" strokeWidth="2" 
                            strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2l1.5 3.5L17 7l-3.5 1.5L12 12l-1.5-3.5L7 7l3.5-1.5L12 2zM24 10l.75 1.75L27 12l-2.25.25L24 14l-.75-1.75L21 12l2.25-.25L24 10zM8 20l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/>
                    </svg>
                Get Your Personalized Matches</h3>
                <p>Our AI will analyze your skills, experience, and preferences</p>
                <div className="match-item">
                    <div className="match-svg-content">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" 
                            viewBox="0 0 24 24" fill="none" stroke="#7FB69E" strokeWidth="2" 
                            strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="17" r="4"></circle>
                            <path d="M8 3h8l-2 6h-4L8 3z"></path>
                        </svg>
                        <h4>Profile Analysis</h4>
                    </div>
                    <p>We analyze your skills, experience, and career goals from your resume</p>
                </div>
                <div className="match-item">
                    <div className="match-svg-content">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" 
                            viewBox="0 0 24 24" fill="none" stroke="#7FB69E" strokeWidth="2" 
                            strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 17 9 11 13 15 21 7"></polyline>
                            <polyline points="14 7 21 7 21 14"></polyline>
                        </svg>
                        <h4>Smart Matching</h4>
                    </div>              
                    <p>Our AI compares your profile with thousands of job listings</p>
                </div>
                <div className="match-item">
                    <div className="match-svg-content">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" 
                            viewBox="0 0 24 24" fill="none" stroke="#7FB69E" strokeWidth="2" 
                            strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15 9 22 9 17 14 18.5 21 12 17.5 5.5 21 7 14 2 9 9 9 12 2"></polygon>
                        </svg>
                        <h4>Ranked Results</h4>
                    </div>
                    <p>Get job recommendations ranked by match score from highest to lowest</p>
                </div>
                <button 
                    onClick={matchResume}
                    disabled={statusPopup.type === "loading"}
                    className={statusPopup.type === "loading" ? 'loading' : ''}
                >
                    {statusPopup.type === "loading" ? (
                        <span className="button-loading">
                            <div className="spinner"></div>
                            Finding Your Perfect Jobs...
                        </span>
                    ) : "Find My Perfect Jobs"}
                </button>
                {!resumeText && (
                    <p>Please upload your resume in your profile first to get matches</p>
                )}
            </div>
            }   
        </>
    )
}
