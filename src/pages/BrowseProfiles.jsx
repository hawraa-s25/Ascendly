import { useOutletContext } from "react-router-dom"
import defaultImage from "./defaultProfileImage.jpeg"
import React from "react"
import StatusPopup from "./StatusPopup"
import { textTruncation } from "../commonFunctions"

export default function BrowseProfiles(props){
    const { allProfiles, user, startAdminEdit } = useOutletContext()
    const [statusPopup, setStatusPopup] = React.useState({
        show: false,
        message: "",
        type: ""
    })
    
    const profile = allProfiles.find(profile => profile.userId === user.uid)

    //Status declaration for toast alerts

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

    //Handling functions

    function handleViewProfile(profile){
        props.setSelectedProfile(profile)
    }

    function handleBackToList(){
        props.setSelectedProfile(null)
    }

    function handleAdminEdit(profile){
        try {
            showStatus("Opening admin edit mode...", "loading")
            startAdminEdit(profile)
            showStatus("Admin edit mode ready", "success")
        } catch (error) {
            console.error("Error starting admin edit:", error)
            showStatus("Failed to open admin edit", "error")
        }
    }

    //Trigger popup if no user authenticated

    if (!user) {
        return (
            <>
                <StatusPopup statusPopup={statusPopup} onClose={hideStatus} />
                <div className="browseBodyContent">
                    <h2>Browse Professionals</h2>
                    <p>Please sign in to browse profiles</p>
                </div>
            </>
        )
    }

    return(
        <>
            <StatusPopup statusPopup={statusPopup} onClose={hideStatus} />
            
            {!props.selectedProfile ? (
            <>
            <div className="browseBodyContent">
                <h2>Browse Professionals</h2>
                <p>Connect with talented professionals</p>
            </div>
            <div className="profiles-list">
            {allProfiles
                .filter(profile => profile.userId !== user.uid && profile.role !== "admin")
                .map((Profile, i) =>(
                <div key={i}>
                    <img src={Profile.profileURL || defaultImage} alt={`${Profile.firstName}'s profile`}/>
                    <h4>{Profile.firstName} {Profile.lastName}</h4>
                    <p>{Profile.professionTitle || "No Profession Title"}</p>
                    <p className="svg-content">
                        <svg xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            width="20" height="20"
                            fill="none"
                            stroke="#7FB69E"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            className="icon icon-location">
                        <path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 1118 0z"></path>
                        <circle cx="12" cy="10" r="2.5"></circle>
                    </svg>{Profile.location || "No location specified"}</p>
                    <p>{ textTruncation(Profile.bio, 120) || "No bio available"}</p>
                    {Profile.role === "jobseeker" ? ( Profile.skills?.length > 0 ? <ul className="skills-list-browse">
                        {Profile.skills?.map((skill,i) => (
                            <li key={i}>{skill}</li>                                
                        ))}
                    </ul> : <p>No skills added</p>) : null}             
                    <button 
                        className="view-profile" 
                        onClick={()=>handleViewProfile(Profile)}
                        disabled={statusPopup.type === "loading"}
                    >
                        {statusPopup.type === "loading" ? "Loading..." : "View Profile"}
                    </button>
                </div>
                ))}
            </div>
            </> 
                ) : ( 
            <>
            
            <div className="user-profile">
                <img src={props.selectedProfile.profileURL || defaultImage} id="profilePicture" alt={`${props.selectedProfile.firstName}'s profile`}/>
                <div className="user-profile-content">
                    <h2>{props.selectedProfile.firstName} {props.selectedProfile.lastName}</h2>
                    {props.selectedProfile.role === "jobseeker" && <p>{props.selectedProfile.professionTitle || ""}</p>}
                    <p className="svg-content"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="#7FB69E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="icon">
                            <rect x="2" y="4" width="16" height="12" rx="2" ry="2"/>
                            <polyline points="2,6 10,11 18,6"/>
                        </svg>
                    <span>{props.selectedProfile.email}</span></p>
                    <p className="svg-content">
                        <svg xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            width="20" height="20"
                            fill="none"
                            stroke="#7FB69E"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            className="icon icon-location">
                        <path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 1118 0z"></path>
                        <circle cx="12" cy="10" r="2.5"></circle>
                    </svg>{props.selectedProfile.location || "unspecified"}</p>
                    <h3>About</h3>
                    <p>{props.selectedProfile.bio}</p> 
                </div>
                { profile?.role === "admin" && <button  
                    className="edit-btn" 
                    onClick={() => handleAdminEdit(props.selectedProfile)}
                    disabled={statusPopup.type === "loading"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M16 3l5 5L7 22H2v-5L16 3z" />
                    </svg>
                    {statusPopup.type === "loading" ? "Opening..." : "Edit Profile"}
                </button>}
                <button 
                    onClick={handleBackToList} 
                    className="back-to-browse"
                    disabled={statusPopup.type === "loading"}
                >
                    {statusPopup.type === "loading" ? "Loading..." : "Back to Profiles"}
                </button>
            </div>

            {props.selectedProfile.role === "jobseeker" && (
                <>
                <div className="resumeContainer">
                    <h3 className="svg-content">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="25" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="icon">
                            <path d="M4 2h9l5 5v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
                            <polyline points="13 2 13 7 18 7"/>
                            <line x1="6" y1="12" x2="14" y2="12"/>
                            <line x1="6" y1="15" x2="10" y2="15"/>
                        </svg>
                        Resume
                    </h3>
                        
                    {props.selectedProfile.resumeURL ? <div className="resume-view">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="25" fill="none" stroke="#7FB69E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="icon">
                            <path d="M4 2h9l5 5v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
                            <polyline points="13 2 13 7 18 7"/>
                            <line x1="6" y1="12" x2="14" y2="12"/>
                            <line x1="6" y1="15" x2="10" y2="15"/>
                        </svg>
                        <a href={props.selectedProfile.resumeURL} target="_blank" rel="noopener noreferrer" className="view-resume-btn">
                                {props.selectedProfile.resumeName ? props.selectedProfile.resumeName: "View Resume"} 
                        </a>
                        
                    </div>: <p id="resume-unavailable">No resume available</p>}                
                </div>
                <div className="jobSeekerProfile">
                    <div className="education-skills">
                        <div className="education-section">
                        <h3 className="svg-content"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="icon">
                                <path d="M4 10v4c0 1 3 2 6 2s6-1 6-2v-4"/>
                                <path d="M2 8l8-4 8 4-8 4-8-4z"/>
                                <path d="M12 12h0"/>
                            </svg>
                        Education</h3>
                        {props.selectedProfile.education?.length > 0 ? (
                            props.selectedProfile.education?.map((edu, i) => (
                            <div key={i} className="education-item">
                                <h4>{edu.degree || "Unknown Degree"}</h4>
                                <p>{edu.institution || "Unknown Institution"}</p>
                                <span>{edu.startYear} - {edu.endYear}</span>
                            </div>
                            ))
                        ) : (
                            <p>No education details added yet.</p>
                        )}
                        </div>
                        <ul className="skills-list">
                            <h3>Skills</h3>
                            {props.selectedProfile.skills?.length > 0 ? <p>{props.selectedProfile.skills?.map((skill,i) => (
                                <li key={i}>{skill}</li>                                
                            ))}</p> : <p>No skills added yet.</p>}
                        </ul>
                    </div>
                    <div className="experience-section">
                        <h3 className="svg-content">
                            <svg xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                width="20" height="20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                                className="icon icon-briefcase">
                            <rect x="2" y="7" width="20" height="13" rx="2" ry="2"></rect>
                            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path>
                            <path d="M2 13h20"></path>
                            </svg>
                            Experience
                        </h3>
                        {props.selectedProfile.experience?.length > 0 ? (
                            props.selectedProfile.experience?.map((exp, i) => (
                            <div key={i} className="experience-item">
                                <h4>{exp.role || "Unknown Role"}</h4>
                                <p>{exp.company || "Unknown Company"}</p>
                                <span>{exp.startYear} - {exp.endYear}</span>
                                <p>{exp.expDescription || ""}</p>
                            </div>
                            ))
                        ) : (
                            <p>No work experience added yet.</p>
                        )}
                    </div>     
                </div>  
                </>
            )}
            {props.selectedProfile.role === "recruiter" && (
                <div className="jobRecruiterProfile">
                <h3 className="svg-content">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-building2 lucide-building-2 w-12 h-12 text-muted-foreground" aria-hidden="true">
                        <path d="M10 12h4"></path>
                        <path d="M10 8h4"></path>
                        <path d="M14 21v-3a2 2 0 0 0-4 0v3"></path>
                        <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"></path>
                        <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"></path>
                    </svg>
                    Company Information
                </h3>

                <div className="company-container">
                    {props.selectedProfile.companyLogo !== "" ? 
                    (
                        <div className="company-logo">
                            <img src={props.selectedProfile.companyLogo} alt="Company Logo"/>
                        </div>
                    )
                    :
                    (
                        <div className="company-logo-default">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M10 12h4"></path>
                                <path d="M10 8h4"></path>
                                <path d="M14 21v-3a2 2 0 0 0-4 0v3"></path>
                                <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"></path>
                                <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"></path>
                            </svg>
                        </div>
                    )}
                    

                    <div className="company-details">
                    <h2>{props.selectedProfile.companyName || "Unspecified"}</h2>
                    <p className="svg-content">
                        <svg xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            width="20" height="20"
                            fill="none"
                            stroke="#7FB69E"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            className="icon icon-briefcase">
                            <rect x="2" y="7" width="20" height="13" rx="2" ry="2"></rect>
                            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path>
                            <path d="M2 13h20"></path>
                        </svg>
                        {props.selectedProfile.industry || "Industry not specified"}
                    </p>
                    <p className="svg-content">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7FB69E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-globe w-4 h-4" aria-hidden="true">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                            <path d="M2 12h20"></path>
                        </svg>
                        {props.selectedProfile.companyWebsite ? (
                        <a href={props.selectedProfile.companyWebsite} target="_blank" rel="noreferrer">
                            {props.selectedProfile.companyWebsite}
                        </a>
                        ) : (
                        "No website available"
                        )}
                    </p>

                    <h3>About the Company</h3>
                    <p> {props.selectedProfile.companyDescription || "No company description provided yet."}</p>
                    </div>
                </div>
                </div>
            )}
            </>)}
        </>
    )
}
