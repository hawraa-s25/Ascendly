import React from "react"
import { db, extractData } from "../firebase"
import {ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { fetchItemData, handleInputChange, uploadImages } from "../commonFunctions"
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"
import defaultImage from "./defaultProfileImage.jpeg"
import "./Profile.css"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import StatusPopup from "./StatusPopup"

export default function Profile(props){

    const user=props.auth.currentUser
    const storage=props.storage
    const userInfo=props.userInfo
    const navigate = useNavigate()
    const location = useLocation()
    const isBrowsing = location.pathname !== "/app/profile"
    const signedWithGoogle = user?.providerData[0].providerId === "google.com"

    if (!user) {
        return (
                <div className="bodyContent">
                    <div className="textContent">
                        <h2>Messages</h2>
                        <p>Please sign in to view messages</p>
                    </div>
                </div>
        )
    }

    const profileRef = doc(db, "profile", user.uid)

    const [userData, setUserData] = React.useState({
        resumeText: "",
        resumeName: "",
        resumeURL: "",
        userId: user.uid,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        email: user.email,
        role: "",
        bio: "",
        location: "",
        profileURL: "",
        education: [],
        experience: []
    })
    const [editedData, setEditedData] = React.useState({ ...userData })
    const [editingProfile, setEditing] = React.useState(false)
    const [skillInput, setSkillInput] = React.useState("")
    const [adminEditData, setAdminEditData] = React.useState(null)
    const [isAdminEditing, setIsAdminEditing] = React.useState(false)
    const [statusPopup, setStatusPopup] = React.useState({
        show: false,
        message: "",
        type: "" 
    })
    const [openPopup, setPopup] = React.useState(false)

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
        loadProfileData()
    }, [])

    React.useEffect(()=>{
        const unsubscribe = fetchItemData("profile", props.setAllProfiles)
        return () => unsubscribe()
    },[])

    React.useEffect(()=>{
        addProfileToDB(userData)
    },[user])

    React.useEffect(() => {
        if (signedWithGoogle && !userData.role) {
            setPopup(true)
        } else {
            setPopup(false)
        }
    }, [signedWithGoogle, userData.role])

    async function loadProfileData() {
        showStatus("Loading profile...", "loading")
        try {
            const snapshot = await getDoc(profileRef)
            
            if(snapshot.exists()){
                const data = snapshot.data()
                setUserData(prev => ({
                    ...prev,
                    ...data
                }))
                if (data.resumeText) {
                    props.setResumeText(data.resumeText)
                }
                showStatus("Profile loaded successfully!", "success")
            } else {

                const displayName = user.displayName || ""
                const nameParts = displayName.split(" ")
                const googleFirstName = nameParts[0] || ""
                const googleLastName = nameParts.slice(1).join(" ") || ""

                const initialProfileData = {
                    resumeText: "",
                    resumeName: "",
                    resumeURL: "",
                    userId: user.uid,
                    firstName: userInfo.firstName || googleFirstName || "",
                    lastName: userInfo.lastName || googleLastName || "",
                    email: user.email,
                    role: userInfo.role,
                    bio: "",
                    location: "",
                    profileURL: "",
                    education: [],
                    experience: []
                }
                
                await setDoc(profileRef, initialProfileData)
                setUserData(initialProfileData)
                showStatus("Profile created successfully!", "success")
            }
        } catch (error) {
            console.error("Error loading profile:", error)
            showStatus("Failed to load profile", "error")
        }
    }

    async function addProfileToDB(userData){
        const profileRef = doc(db, "profile", userData.userId)
        const snapshot = await getDoc(profileRef)
        
        if(!snapshot.exists()){
            await setDoc(profileRef, userData)
        } else {
            console.log("Profile already exists")
        }
    }

    async function UploadResumeToStorage(file){
        const fileRef = ref(storage, `uploads/${user.uid}/${file.name}`)
        try{
            await uploadBytes(fileRef, file)
            console.log("File is uploaded successfully to storage")
            const downloadURL = await getDownloadURL(fileRef)
            return downloadURL
        }
        catch(error) {
            console.error("Upload failed:", error)
            throw error
        }
    }

    async function handleResumeChange(e) {
        const file = e.target.files[0]
        if (!file) return
        
        const fileExtension = file.name.split('.').pop().toLowerCase()
        const allowedExtensions = ['pdf', 'doc', 'docx']

        if (!allowedExtensions.includes(fileExtension)) {
            showStatus(
                `Unsupported file type: .${fileExtension}. ` +
                `Please upload a PDF (.pdf) or Word document (.doc, .docx).`,
                "error"
            )
            e.target.value = ''
            return
        }
        showStatus("Uploading and processing document...", "loading")

        try {
            const resumeURL = await UploadResumeToStorage(file)
            const fileData = await new Promise((resolve, reject) => {
                const reader = new FileReader()
                
                reader.onload = (event) => {
                    const base64Data = event.target.result.split(',')[1]
                    resolve(base64Data)
                }
                
                reader.onerror = () => {
                    reject(new Error("Failed to read the file. It may be corrupted."))
                }

                reader.readAsDataURL(file)
            })

            showStatus("Extracting text from document...", "loading")
            
            const extractResponse = await fetch('/api/extractData', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fileData: fileData,
                    fileType: fileExtension,
                    fileName: file.name
                })
            })

            const extractResult = await extractResponse.json()

            if (!extractResponse.ok || !extractResult.success) {
                throw new Error(extractResult.error || `API Error: ${extractResponse.status}`)
            }
            
            const extractedText = extractResult.extractedText

            if (!extractedText || extractedText.trim().length === 0) {
                throw new Error("The document appears to be empty or no text could be extracted.")
            }

            showStatus("AI is structuring the extracted data...", "loading")

            const parseResponse = await fetch('/api/parseData', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ resumeText: extractedText }),
            })

            const parseResult = await parseResponse.json()

            if (!parseResponse.ok || !parseResult.success) {
                throw new Error(parseResult.error || `AI parsing failed: ${parseResponse.status}`)
            }
            
            const parsedData = parseResult.parsedData || {}

            const updatedProfileData = {
                ...parsedData,
                resumeText: extractedText,
                resumeURL: resumeURL,
                resumeName: file.name
            }
            await updateDoc(doc(db, "profile", user.uid), updatedProfileData)

            setUserData(prev => ({ 
                ...prev, 
                ...updatedProfileData
            }))

            if (props.setResumeText) {
                props.setResumeText(extractedText)
            }

            showStatus(
                `Successfully parsed ${file.name} and updated your profile!`, 
                "success"
            )

        } catch (error) {
            console.error("Document processing error:", error)
            let userMessage = error.message
            if (error.message.includes("Failed to fetch") || 
                error.message.includes("NetworkError")) {
                userMessage = "Network error. Please check your internet connection and try again."
            } else if (error.message.includes("corrupt") || 
                       error.message.includes("corrupted")) {
                userMessage = "The file appears to be corrupted. Please try a different file."
            } else if (error.message.includes("password")) {
                userMessage = "The document is password protected. Please remove the password and try again."
            } else if (error.message.includes("empty")) {
                userMessage = "The document appears to be empty or contains no text."
            } else if (error.message.includes("AI parsing failed")) {
                userMessage = "AI parsing failed. The extracted text may be unclear or in an unsupported format."
            }
            
            showStatus(`Failed to process document: ${userMessage}`, "error")
        }
    }

    async function saveProfileChanges(profileData, isAdmin = false, onSuccess = null){
        showStatus("Saving profile changes...", "loading")
        try {
            const currentProfileRef = isAdmin ? doc(db, "profile", profileData.userId) : profileRef
            await updateDoc(currentProfileRef, profileData)
            if (isAdmin){
                if (onSuccess) onSuccess()
            } 
            else {
                setUserData(profileData)
                setEditing(false)
            }
            showStatus("Profile updated successfully!", "success")
        } catch (error) {
            console.error("Error saving profile:", error)
            showStatus("Failed to save profile changes", "error")
        }
    }

    function addSkill(e){
        e.preventDefault()
        setEditedData(prevData => ({
            ...prevData,
            skills: [...(prevData.skills || []), skillInput]
        }))
        setSkillInput("")
    }

    function deleteSkill(skillToRemove){
        setEditedData(prevData => ({
            ...prevData,
            skills: prevData.skills?.filter(skill => skill != skillToRemove)
        }))
    }

    function handleArrayChange(e, index, type) {
        const { name, value } = e.target
        setEditedData(prev => {
            const updated = [...prev[type]]
            updated[index][name] = value
            return { ...prev, [type]: updated }
        })
    }

    function addArrayItem(type) {
        const newItem =
            type === "education" ? { degree: "", institution: "", startYear: "", endYear: "" }
                                 : { role: "", company: "", startYear: "", endYear: "" }

        setEditedData(prev => ({
            ...prev,
            [type]: [...(prev[type] || []), newItem],
        }))
    }

    function removeArrayItem(index, type) {
        setEditedData(prev => ({
            ...prev,
            [type]: prev[type].filter((_, i) => i !== index),
        }))
    }

    async function handleImageChange(e){
        showStatus("Uploading profile image...", "loading")
        try {
            const filePath = e.target.files[0]
            const imageURL = await uploadImages(filePath)
            setEditedData(prev => ({...prev, profileURL: imageURL}))
            showStatus("Profile image uploaded successfully!", "success")
        } catch (error) {
            console.error("Error uploading image:", error)
            showStatus("Failed to upload profile image", "error")
        }
    }

    async function handleLogoChange(e) {
        showStatus("Uploading company logo...", "loading")
        try {
            const filePath = e.target.files[0]
            const logoURL = await uploadImages(filePath)
            setEditedData(prev => ({...prev, companyLogo: logoURL}))
            showStatus("Company logo uploaded successfully!", "success")
        } catch (error) {
            console.error("Error uploading logo:", error)
            showStatus("Failed to upload company logo", "error")
        }
    }

    async function handleDeleteResume(){
        showStatus("Deleting resume...", "loading")
        try {
            await updateDoc(doc(db, "profile", user.uid), {
                resumeURL: "",
                resumeName: "",
                resumeText: ""
            })
            if (userData.resumeName) {
                const fileRef = ref(storage, `uploads/${user.uid}/${userData.resumeName}`)
                await deleteObject(fileRef)
            }
            setUserData(prev => ({ 
                ...prev, 
                resumeURL: "", 
                resumeName: "",
                resumeText: "" 
            }))
            props.setResumeText("")
            showStatus("Resume deleted successfully!", "success")
        } catch (error) {
            console.error("Error deleting resume:", error)
            showStatus("Failed to delete resume", "error")
        }
    }

    function startAdminEdit(profile){
        setAdminEditData({...profile})
        setIsAdminEditing(true)
    }

    function renderEditProfile(onClose = () => setEditing(false), isAdmin = false){

        const currentEditData = isAdmin ? adminEditData : editedData
        const setCurrentEdit = isAdmin ? setAdminEditData : setEditedData

        const handleSave = async (e) => {
            e.preventDefault()
            await saveProfileChanges(currentEditData, isAdmin, onClose)
        }

        const handleAddArrayItem = (type, e) => {
            e.preventDefault()
            addArrayItem(type)
        }

        return (
            <div className="editProfileOverlay">
            <div className="editProfileContainer">

                <div className="bodyContent">
                    <div>
                        <h3>Edit Profile</h3>
                        <p>Update your profile information, skills, education, and work experience.</p>
                    </div>                     
                    <button onClick={onClose} className="overlay-back-btn">x</button>
                </div>

                <form 
                    onSubmit={(e) => e.preventDefault()}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault()
                    }}}
                >

                <div className="multi-field">
                    <div className="input-label">
                        <label>First Name</label>
                        <input 
                            type="text" 
                            name="firstName"
                            placeholder="First Name"
                            value={currentEditData.firstName || ""}
                            onChange={(e)=> handleInputChange(e, setCurrentEdit)}
                            disabled={statusPopup.type === "loading"}
                        />
                    </div>
                    
                    <div className="input-label">
                        <label>Last Name</label>
                        <input 
                            type="text" 
                            name="lastName"
                            placeholder="Last Name"
                            value={currentEditData.lastName || ""}
                            onChange={(e)=> handleInputChange(e, setCurrentEdit)}
                            disabled={statusPopup.type === "loading"}
                        />
                    </div>
                </div>

                <div className="multi-field">
                    <div className="input-label">
                        <label>Profession Title</label>
                        <input 
                            type="text" 
                            name="professionTitle"
                            placeholder="Profession Title"
                            value={currentEditData.professionTitle || ""}
                            onChange={(e)=> handleInputChange(e, setCurrentEdit)}
                            disabled={statusPopup.type === "loading"}
                        />
                    </div>
                    <div className="input-label">
                        <label>Location</label>
                        <input 
                            type="text" 
                            name="location"
                            placeholder="Location"
                            value={currentEditData.location || ""}
                            onChange={(e)=> handleInputChange(e, setCurrentEdit)}
                            disabled={statusPopup.type === "loading"}
                        />
                    </div>                  
                </div>
                
                <label>Profile Image</label>
                <div className="image-upload">
                    <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e)=>handleImageChange(e)}
                        disabled={statusPopup.type === "loading"}
                    /> 
                </div>
                {currentEditData.profileURL && 
                    <div className="profile-image-container">
                        <img src={currentEditData.profileURL} alt="profile picture"/>
                        <button 
                            onClick={() => setCurrentEdit(prev => ({...prev, profileURL: ""}))}
                            disabled={statusPopup.type === "loading"}
                        >Delete</button>
                    </div>
                }
                                                    
                <label>About</label>
                <input 
                    type="text" 
                    id="about-input"
                    name="bio"
                    placeholder="Bio"
                    value={currentEditData.bio || ""}
                    onChange={(e)=> handleInputChange(e, setCurrentEdit)}
                    disabled={statusPopup.type === "loading"}
                />

                {currentEditData.role==="jobseeker" && (
                    <>
                    <div className="history-header">
                        <label>Work Experience</label>
                        <button 
                            onClick={(e) => handleAddArrayItem("experience", e)}
                            disabled={statusPopup.type === "loading"}
                        >+ Add Experience</button>
                    </div>
                    {currentEditData.experience?.map((exp, i) => (
                    <div key={i} className="history-container">
                        <div className="history-remove">
                            <h4>Experience Entry</h4>
                            <button 
                                onClick={() => removeArrayItem(i, "experience")}
                                disabled={statusPopup.type === "loading"}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22m-5-4H6a2 2 0 00-2 2v2h16V5a2 2 0 00-2-2z" />
                                </svg>
                                Remove
                            </button>
                        </div>

                        <label>Job Title</label>
                        <input
                            type="text"
                            name="role"
                            placeholder="Job Role / Position"
                            value={exp.role}
                            onChange={(e) => handleArrayChange(e, i, "experience")}
                            disabled={statusPopup.type === "loading"}
                        />
                        
                        <label>Company</label>
                        <input
                            type="text"
                            name="company"
                            placeholder="Company Name"
                            value={exp.company}
                            onChange={(e) => handleArrayChange(e, i, "experience")}
                            disabled={statusPopup.type === "loading"}
                        />
                        
                        <label>Period</label>
                        <div className="period-fields">
                            <input
                                type="text"
                                name="startYear"
                                placeholder="Start Year"
                                value={exp.startYear}
                                onChange={(e) => handleArrayChange(e, i, "experience")}
                                disabled={statusPopup.type === "loading"}
                            />
                            <input
                                type="text"
                                name="endYear"
                                placeholder="End Year"
                                value={exp.endYear}
                                onChange={(e) => handleArrayChange(e, i, "experience")}
                                disabled={statusPopup.type === "loading"}
                            />
                        </div>

                        <label>Description</label>
                        <input
                            type="text"
                            name="expDescription"
                            placeholder="Work Experience Description"
                            value={exp.expDescription}
                            onChange={(e) => handleArrayChange(e, i, "experience")}
                            disabled={statusPopup.type === "loading"}
                        />                           
                    </div>
                    ))}                  
                    <div className="history-header">
                        <label>Education</label>
                        <button 
                            onClick={(e) => handleAddArrayItem("education", e)}
                            disabled={statusPopup.type === "loading"}
                        >+ Add Education</button>
                    </div>
                    {currentEditData.education?.map((edu, i) => (
                    <div key={i} className="history-container">
                        <div className="history-remove">
                            <h4>Education Entry</h4>
                            <button 
                                onClick={() => removeArrayItem(i, "education")}
                                disabled={statusPopup.type === "loading"}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22m-5-4H6a2 2 0 00-2 2v2h16V5a2 2 0 00-2-2z" />
                                </svg>
                                Remove
                            </button>
                        </div>
                        <label>Degree / Certification</label>
                        <input
                            type="text"
                            name="degree"
                            placeholder="Degree / Certificate"
                            value={edu.degree}
                            onChange={(e) => handleArrayChange(e, i, "education")}
                            disabled={statusPopup.type === "loading"}
                        />

                        <label>School</label>
                        <input
                            type="text"
                            name="institution"
                            placeholder="University / School"
                            value={edu.institution}
                            onChange={(e) => handleArrayChange(e, i, "education")}
                            disabled={statusPopup.type === "loading"}
                        />
                        
                        <label>Period</label>
                        <div className="period-fields">
                            <input
                                type="text"
                                name="startYear"
                                placeholder="Start Year"
                                value={edu.startYear}
                                onChange={(e) => handleArrayChange(e, i, "education")}
                                disabled={statusPopup.type === "loading"}
                            />
                            <input
                                type="text"
                                name="endYear"
                                placeholder="End Year"
                                value={edu.endYear}
                                onChange={(e) => handleArrayChange(e, i, "education")}
                                disabled={statusPopup.type === "loading"}
                            />                           
                        </div>
                    </div>
                    ))}                       

                    <label>Skills</label>
                    <div className="skills-add">
                        <input
                            type="text"
                            name="skills"
                            value={skillInput || ""}
                            onChange={(e) => setSkillInput(e.target.value)}
                            placeholder="Enter a skill"
                            disabled={statusPopup.type === "loading"}
                        />
                        <button 
                            type="button"
                            onClick={(e)=>addSkill(e)}
                            disabled={statusPopup.type === "loading"}
                        >Add</button>
                    </div>
                    
                    <ul className="requirements-skills-list">{currentEditData.skills?.map((skill,i) => (
                        <span className="requirement-skill-item" key={i}>
                            {skill}
                            <button 
                                onClick={()=>deleteSkill(skill)} 
                                className="deleteReq"
                                disabled={statusPopup.type === "loading"}
                            >x</button>
                        </span>
                    ))}</ul>
                    </>      
                )}

                {currentEditData.role==="recruiter" && (
                    <>

                    <label>Company Name</label>
                    <input 
                        type="text" 
                        name="companyName"
                        placeholder="Company Name"
                        value={currentEditData.companyName || ""}
                        onChange={(e)=> handleInputChange(e, setCurrentEdit)}
                        disabled={statusPopup.type === "loading"}
                    />

                    <label>Company Website</label>
                    <input 
                        type="text" 
                        name="companyWebsite"
                        placeholder="Website"
                        value={currentEditData.companyWebsite || ""}
                        onChange={(e)=> handleInputChange(e, setCurrentEdit)}
                        disabled={statusPopup.type === "loading"}
                    />

                    <label>Industry</label>
                    <input 
                        type="text"
                        name="industry"
                        placeholder="Industry"
                        value={currentEditData.industry || ""}
                        onChange={(e)=> handleInputChange(e, setCurrentEdit)}
                        disabled={statusPopup.type === "loading"}
                    />

                    <label>Company Logo</label>
                    <div className="image-upload">
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e)=>handleLogoChange(e)}
                            disabled={statusPopup.type === "loading"}
                        /> 
                    </div>
                    {currentEditData.companyLogo && 
                        <div className="profile-image-container">
                            <img src={currentEditData.companyLogo} alt="company logo"/>
                            <button 
                                onClick={() => setCurrentEdit(prev => ({...prev, companyLogo: ""}))}
                                disabled={statusPopup.type === "loading"}
                            >Delete</button>
                        </div>
                    }

                    <label>Company Description</label>
                    <input 
                        type="text"
                        name="companyDescription"
                        placeholder="Description"
                        value={currentEditData.companyDescription || ""}
                        onChange={(e)=> handleInputChange(e, setCurrentEdit)}
                        disabled={statusPopup.type === "loading"}
                    />
                    </>
                )}

                <button 
                    onClick={(e)=>handleSave(e)} 
                    className="submit-btn"
                    disabled={statusPopup.type === "loading"}
                >
                    {statusPopup.type === "loading" ? (
                        <span className="button-loading">
                            <div className="spinner"></div>
                            Saving...
                        </span>
                    ) : "Save Changes"}
                </button>
                </form>
            </div>
            </div>
        )
    
    }

    return(
        <>
            {openPopup && 
            <div className="overlay">
                <div className="googleRole">
                    <div className="bodyContent">
                        <h2>Welcome! Tell us about yourself</h2>
                        <p>Choose your account type to personalize your experience</p>
                    </div>
                    <div className="choose-role">
                        <button onClick={()=>{setUserData(prev => ({...prev, role: "jobseeker"}))}}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="#7FB69E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-user w-8 h-8 text-primary" aria-hidden="true">
                                <circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="10" r="3"></circle>
                                <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"></path>
                            </svg>
                            <h3>Job Seeker</h3>
                            <p>I'm looking for job opportunities</p>
                        </button>
                        <button onClick={()=>{setUserData(prev => ({...prev, role: "recruiter"}))}}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 25" fill="none" stroke="#7FB69E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-briefcase w-8 h-8 text-primary" aria-hidden="true">
                                <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                                <rect width="20" height="14" x="2" y="6" rx="2"></rect>
                            </svg>
                            <h3>Job Recruiter</h3>
                            <p>I'm hiring talent for my company</p>
                        </button>
                    </div>
                </div>
            </div>}
            <StatusPopup 
                statusPopup={statusPopup} 
                onClose={hideStatus}
            />
            
            <div className="profile-navigation">
                <button 
                    onClick={()=>navigate("/app/profile")}
                    className={location.pathname === "/app/profile" ? "active" : ""}
                >My Profile</button>
                <button 
                    onClick={()=>navigate("/app/profile/browse")}
                    className={location.pathname === "/app/profile/browse" ? "active" : ""}
                >Browse Profiles</button>
            </div>
            <Outlet context={{ 
                                allProfiles: props.allProfiles,
                                user: user,
                                startAdminEdit: startAdminEdit
                            }}/>
            {isAdminEditing && adminEditData && renderEditProfile(() => {
                setIsAdminEditing(false)
                setAdminEditData(null)
            }, true)}
            {editingProfile && user.uid && renderEditProfile(() => setEditing(false), false)}
            {!isBrowsing && <div className="user-profile">
                <img src={userData.profileURL || defaultImage} id="profilePicture"/>
                <div className="user-profile-content">
                    <h2>{userData.firstName} {userData.lastName}</h2>
                    <p>{userData.professionTitle || ""}</p>
                    <p className="svg-content"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="#7FB69E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="icon">
                            <rect x="2" y="4" width="16" height="12" rx="2" ry="2"/>
                            <polyline points="2,6 10,11 18,6"/>
                        </svg>
                    <span>{userData.email}</span></p>
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
                    </svg>{userData.location || "unspecified"}</p>
                    <h3>About</h3>
                    <p>{userData.bio}</p>
                </div>
                {!editingProfile && <button 
                    onClick={()=>{
                        setEditedData({ ...userData })
                        setEditing(true)}
                    } 
                    className="edit-btn"
                    disabled={statusPopup.type === "loading"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M16 3l5 5L7 22H2v-5L16 3z" />
                    </svg>
                    Edit Profile
                </button>}
            </div>}
            {!isBrowsing && userData.role === "jobseeker" && (
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
                    {!userData.resumeURL ? <div className="file-upload">
                        <input
                            type="file"
                            onChange={handleResumeChange}
                            className="file-input"
                            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            disabled={statusPopup.type === "loading"}
                        />
                    </div> : 
                    <div className="resume-view">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="25" fill="none" stroke="#7FB69E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="icon">
                            <path d="M4 2h9l5 5v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
                            <polyline points="13 2 13 7 18 7"/>
                            <line x1="6" y1="12" x2="14" y2="12"/>
                            <line x1="6" y1="15" x2="10" y2="15"/>
                        </svg>
                        <a 
                            href={userData.resumeURL} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="view-resume-btn"
                        >
                            {userData.resumeName ? userData.resumeName: "View Resume"} 
                        </a>
                        <button 
                            onClick={handleDeleteResume}
                            disabled={statusPopup.type === "loading"}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                width="24" 
                                height="24">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>}                    
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
                        {userData.education?.length > 0 ? (
                            userData.education?.map((edu, i) => (
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
                            {userData.skills?.length > 0 ? <p>{userData.skills?.map((skill,i) => (
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
                        {userData.experience?.length > 0 ? (
                            userData.experience?.map((exp, i) => (
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
            {!isBrowsing && userData.role === "recruiter" && (
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
                    {userData.companyLogo ? 
                    (
                        <div className="company-logo">
                            <img src={userData.companyLogo} alt="Company Logo"/>
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
                    <h2>{userData.companyName || "Unspecified"}</h2>
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
                        {userData.industry || "Industry not specified"}
                    </p>
                    <p className="svg-content">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7FB69E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-globe w-4 h-4" aria-hidden="true">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                            <path d="M2 12h20"></path>
                        </svg>
                        {userData.companyWebsite ? (
                        <a href={userData.companyWebsite} target="_blank" rel="noreferrer">
                            {userData.companyWebsite}
                        </a>
                        ) : (
                        "No website available"
                        )}
                    </p>

                    <h3>About the Company</h3>
                    <p> {userData.companyDescription || "No company description provided yet."}</p>
                    </div>
                </div>
                </div>

            )}
        </>
        
    )
}
