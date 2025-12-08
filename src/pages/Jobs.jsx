import React from "react"
import "./Jobs.css"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { 
    doc, 
    collection, 
    updateDoc, 
    onSnapshot, 
    where,
    query,
    getDocs
} from "firebase/firestore"
import { 
    addItemToDatabase, 
    fetchItemData, 
    deletePost, 
    handleInputChange, 
    resetPostData,
    editPost
} from "../commonFunctions"
import { createEmbeddings } from "../firebase"
import { calculateSimilarity } from "../commonFunctions"
import defaultImage from "./defaultProfileImage.jpeg"
import StatusPopup from "./StatusPopup"

export default function Jobs(props){

    const user=props.auth.currentUser
    const db=props.db
    const collectionName="jobs"
    const location = useLocation()
    const isRecommended = location.pathname !== "/app/jobs"
    const profile = user ? props.allProfiles.find(profile => profile.userId === user.uid) : null
    const navigate = useNavigate()

    const [jobPostData, setJobData] = React.useState({
        title: "",
        description: "",
        requirements: [],
        createdBy: {
            authorId: user?.uid || "Anonymous",
            firstName: profile?.firstName || "",
            lastName: profile?.lastName || "",
            profileURL: profile?.profileURL || ""
        },
        applicationURL: "",
        location: "",
        jobType: "",
        salary: {
            min: "",
            max: "",
            currency: "USD",
            period: "year" 
        },
        tags: [],
        isActive: false,
        jobEmbedding: []
    })
    const [isRemote, setRemote] = React.useState(true)
    const [isCreatingPost, setCreating] = React.useState(false)
    const [isFiltering, setFiltering] = React.useState(false)
    const [allJobs, setAllJobs] = React.useState([])
    const [filteredJobs, setFilteredJobs] = React.useState([])
    const [editing, setEditing] = React.useState({
        jobID: null,
        isEditing: false
    })
    const [deleting, setDeleting] = React.useState({
        jobId: "",
        isDeleting: false
    })
    const [urlIsValid, setValidURL] = React.useState(true)
    const [searchText, setSearchText] = React.useState("")
    const [filter, setFilter] = React.useState({
        jobType: "all",
        location: "all",
        salaryMin: "",
        salaryMax: ""
    })
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
        const loadJobs = async () => {
            showStatus("Loading jobs...", "loading")
            try {
                const unsubscribe = fetchItemData(collectionName, (jobs) => {
                    setAllJobs(jobs)
                    setFilteredJobs(jobs)
                })
                showStatus("Jobs loaded successfully!", "success")
                return ()=>unsubscribe()
            } catch (error) {
                console.error(error)
                showStatus("Failed to load jobs", "error")
            }
        }
        loadJobs()
    },[])

    React.useEffect(()=>{
        if (user && profile?.profileURL){
        const updateProfileURLInDocs = async () => {
                const jobsRef = collection(db, "jobs")
                const unsubscribe = onSnapshot(jobsRef, (snapshot) => {
                    snapshot.docs.forEach(async (docSnap) => {
                        const job = docSnap.data()
                        if (job.createdBy?.authorId === user.uid && job.createdBy?.profileURL !== profile.profileURL) {
                            try {
                                await updateDoc(doc(db, "jobs", docSnap.id), {
                                    "createdBy.profileURL": profile.profileURL
                                })
                            } catch (error) {
                                console.error("Failed to update profile URL:", error)
                            }
                        }
                    })
                })
                return unsubscribe
            }
            updateProfileURLInDocs() 
        }
    },[profile?.profileURL, user])

    /* CRUD Functions */

    function addRequirement(e){
        try {
            const newRequirement = (e.target.value).toLowerCase()
            if (!jobPostData.requirements.includes(newRequirement) && newRequirement){
                setJobData(prevFormData => ({
                    ...prevFormData,
                    requirements: [...prevFormData.requirements, newRequirement]
                }))
            } else{
                console.log("Already exists")
            }
        }catch(error){
            console.error("Error:", error.message)
        }
    }

    function deleteRequirement(requirement){
        try{
            const requirementsList = jobPostData.requirements
            setJobData((prev)=>({
                ...prev,
                requirements: requirementsList.filter(req => req != requirement)
            }))
        }catch(error){
            console.error("Error:", error.message)
        }
    }
    
    async function editJobPost(e){
        e.preventDefault()
        showStatus("Updating job post...", "loading")
        
        try {
            const updatedDoc = {
                title: jobPostData.title,
                description: jobPostData.description,
                requirements: jobPostData.requirements,
                createdBy: jobPostData.createdBy,
                applicationURL: jobPostData.applicationURL,
                location: jobPostData.location,
                jobType: jobPostData.jobType,
                salary: jobPostData.salary,
                tags: [],
                isActive: true
            }
            await editPost(collectionName, jobPostData, updatedDoc, setEditing, "jobID")
            setJobData(updatedDoc)
            setEditing({
                jobID: null,
                isEditing: false
            })
            showStatus("Job post updated successfully!", "success")
        } catch(error){
            console.error(error)
            showStatus("Failed to update job post", "error")
        }
    }

    /* Handling Functions */

    function handlePostJob(){
        setCreating(prevCreateState=>!prevCreateState)
        setJobData(resetPostData("job", { uid: user.uid, ...props.userInfo }))
        hideStatus()
    }

    function handleLocationTypeChange(e){
        const remoteState = e.target.value === "remote"
        setRemote(remoteState)
        if(remoteState){
            setJobData({
                ...jobPostData,
                location: remoteState ? "remote" : ""
            })
        }
    }

    function handleSalaryChange(e) {
        const { name, value } = e.target
        const [field, subfield] = name.split('.')
        
        if (subfield) {
            setJobData(prev => ({
                ...prev,
                [field]: {
                    ...prev[field],
                    [subfield]: value
                }
            }))
        }
    }

    function formatSalary(salary) {
        if (!salary || (!salary.min && !salary.max)) return "Salary not specified"
        
        const { min, max, currency, period } = salary
        const currencySymbol = {
            'USD': '$',
            'EUR': '€',
            'LBP': 'lbp'
        }[currency] || currency
        
        const periodText = {
            'year': 'yr',
            'month': 'mo',
            'hour': 'hr'
        }[period] || period
        
        if (min && max) {
            return `${min} - ${max}/${periodText} ${currencySymbol}`
        } else if (min) {
            return `From ${min}/${periodText}`
        } else if (max) {
            return `Up to ${max}/${periodText}`
        }
    }

    async function handleSubmitApplication(e){
        e.preventDefault()
        showStatus("Creating job post...", "loading")
        
        try {
            const finalJobData= {
                ...jobPostData,
                 createdBy: {
                    authorId: user.uid,
                    firstName: profile?.firstName || "",
                    lastName: profile?.lastName || "",
                    profileURL: profile.profileURL || ""
                },
                isActive: true
            }

            const jobRef = await addItemToDatabase(collectionName, finalJobData)
            
            try {
                const jobResult = await createEmbeddings(finalJobData.description + " " + finalJobData.title)
                if (jobResult && jobResult.embedding) {
                    await updateDoc(doc(db, collectionName, jobRef.id), {
                        jobEmbedding: jobResult.embedding
                    })
                } else {
                    console.warn("No embedding generated for job")
                }
            } catch (embeddingError) {
                console.warn("Embedding creation failed, but job was created:", embeddingError)
            }

            setCreating(false)
            setJobData(resetPostData("job", { uid: user.uid, ...props.userInfo}))
            showStatus("Job post created successfully!", "success")
        } catch(error) {
            console.error("Job creation failed:", error)
            
            let errorMessage = "Failed to create job post"
            if (error.code === 'unavailable') {
                errorMessage = "Network error. Please check your connection"
            }
            
            showStatus(errorMessage, "error")
        }
    }

    function handleEditMode(job){
        setEditing({
            jobID: job.id,
            isEditing: true
        })
        setJobData(job)
        hideStatus()
    }

    function handleCancelEdit(){
        setEditing((prev)=>({
            ...prev,
            isEditing:false
        }))
        setJobData(resetPostData("job", { uid: user.uid, ...props.userInfo }))
        hideStatus()
    }

    async function handleSearchJobs(){
        if (!searchText.trim()) {
            showStatus("Please enter search text", "error")
            return
        }
        
        showStatus("Searching jobs...", "loading")
        try{
            const queryEmbedding = await createEmbeddings(searchText)
            if (queryEmbedding && queryEmbedding.embedding) {
                calculateSimilarity(allJobs, "jobEmbedding", queryEmbedding.embedding, setFilteredJobs)
                showStatus(`Search completed for "${searchText}"`, "success")
            } else {
                throw new Error("No embedding generated for search")
            }
        } catch(error){
            console.error(error)
            showStatus("Search failed: " + (error.message || "Unknown error"), "error")
        }
    }

    function handleFiltering(){
        setFiltering(prev => !prev)
    }

    function applyFilters() {
        let filtered = [...allJobs]
        
        if (filter.jobType !== "all") {
            filtered = filtered.filter(job => 
                job.jobType?.toLowerCase() === filter.jobType.toLowerCase()
            )
        }
        
        if (filter.location !== "all") {
            if (filter.location === "remote") {
                filtered = filtered.filter(job => 
                    job.location?.toLowerCase() === "remote"
                )
            } else if (filter.location === "on-site") {
                filtered = filtered.filter(job => 
                    job.location?.toLowerCase() !== "remote" && job.location
                )
            } else if (filter.location === "hybrid") {
                filtered = filtered.filter(job => 
                    job.location?.toLowerCase().includes("hybrid")
                )
            }
        }

        if (filter.salaryMin) {
            filtered = filtered.filter(job => {
                const salaryNum = job.salary?.min ? parseFloat(job.salary.min) : 0
                return salaryNum >= parseFloat(filter.salaryMin)
            })
        }
        
        if (filter.salaryMax) {
            filtered = filtered.filter(job => {
                const salaryNum = job.salary?.max ? parseFloat(job.salary.max) : Infinity
                return salaryNum <= parseFloat(filter.salaryMax)
            })
        }
        
        setFilteredJobs(filtered)
        return filtered
    }

    async function handleApplyFilters(){
        showStatus("Applying filters...", "loading")
        try {
            const result = applyFilters()
            showStatus(`Found ${result.length} jobs`, "success")
            setFiltering(false)
        } catch(error) {
            console.error(error)
            showStatus("Failed to apply filters", "error")
        }
    }

    function handleClearFilters() {
        setFilter({
            jobType: "all",
            location: "all",
            salaryMin: "",
            salaryMax: ""
        })
        setFilteredJobs(allJobs)
        showStatus("Filters cleared", "success")
    }

    async function deleteJobPost(docID){
        setDeleting({ jobId: docID, isDeleting: true })
        showStatus("Deleting job post...", "loading")
        
        try {
            await deletePost(collectionName, docID)
            showStatus("Job post deleted successfully!", "success")
        } catch(error){
            console.error(error)
            
            let errorMessage = "Failed to delete job"
            if (error.code === 'not-found') {
                errorMessage = "Job not found"
            }
            
            showStatus(errorMessage, "error")
        } finally {
            setDeleting({ jobId: "", isDeleting: false })
        }
    }

    function isValidUrl(string) {
        let url
        try {
            url = new URL(string)
        } catch (error) {
            console.error("Error:" ,error.message)
            return false  
        }

        return url.protocol === "http:" || url.protocol === "https:"
    }

    /* Rendering Functions */
    function renderEditModal() {
        if (!editing.isEditing) return null
        
        return (
            <div className="overlay">
                <div className="form-container">
                    <div className="bodyContent">
                        <div>
                            <h3>Edit Job Listing</h3>
                            <p>Update your job listing details</p>
                        </div>
                        <button onClick={handleCancelEdit} className="overlay-back-btn">x</button>
                    </div>
                    <form onSubmit={editJobPost} onKeyDown={(e) => {
                        if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
                            e.preventDefault()
                    }}} className="job-form">
                        <label>Title</label>
                        <input
                            type='text'
                            name='title'
                            value={jobPostData.title} 
                            onChange={(e)=> 
                                handleInputChange(e, setJobData)
                            }
                            placeholder="Title" 
                            required
                            disabled={statusPopup.type === "loading"}
                        />
                        <label>Description</label>
                        <textarea
                            name='description'
                            value={jobPostData.description} 
                            onChange={(e)=> 
                                handleInputChange(e, setJobData)
                            }
                            placeholder="Job Description" 
                            required
                            disabled={statusPopup.type === "loading"}
                        />
                        <label>Job Requirements</label>
                        <input 
                            type="text"
                            name="requirement"
                            onKeyDown={(e)=> {
                                if (e.key === "Enter") {
                                    e.preventDefault()
                                    addRequirement(e)
                                    e.target.value = ""
                                }}}
                            placeholder="Add job requirement…"
                            disabled={statusPopup.type === "loading"}
                        />
                        {jobPostData.requirements.length > 0 && <div className="requirements-skills-list">
                            {jobPostData.requirements.map(requirement => (
                                <span className="requirement-skill-item" key={requirement}>
                                    {requirement}
                                    <button 
                                        onClick={()=>deleteRequirement(requirement)} 
                                        className="deleteReq"
                                        disabled={statusPopup.type === "loading"}
                                    >x</button>
                                </span>
                            ))}
                        </div>}
                        <label>Application URL</label>
                        <input 
                            type="text" 
                            name="applicationURL"
                            value={jobPostData.applicationURL}
                            onChange={(e) => {
                                handleInputChange(e, setJobData)
                                setValidURL(isValidUrl(e.target.value))
                            }}
                            onBlur={(e)=> 
                                {!isValidUrl(e.target.value) &&
                                    setValidURL(false)
                                }
                            }
                            placeholder="Application URL" 
                            disabled={statusPopup.type === "loading"}
                        />
                        {!urlIsValid && <p>URL is not valid</p>}
                        
                        <label>Job Type</label>
                        <select 
                            name="jobType"
                            value={jobPostData.jobType}
                            onChange={(e)=> handleInputChange(e, setJobData)}
                            disabled={statusPopup.type === "loading"}
                        >
                            <option value="">Select Job Type</option>
                            <option value="full time">Full Time</option>
                            <option value="temporary">Temporary</option>
                            <option value="part time">Part Time</option>
                            <option value="contract">Contract</option>
                            <option value="volunteer">Volunteer</option>
                            <option value="internship">Internship</option>
                        </select>
                        
                        <label>Location</label>
                        <div className="choose-location">
                            <label>
                                <input 
                                    type="radio" 
                                    name="locationType" 
                                    value="remote" 
                                    checked={isRemote}
                                    onChange={handleLocationTypeChange}
                                    disabled={statusPopup.type === "loading"}
                                /> Remote 
                            </label>
                            <label>
                                <input 
                                    type="radio" 
                                    name="locationType" 
                                    value="custom" 
                                    checked={!isRemote}
                                    onChange={handleLocationTypeChange}
                                    disabled={statusPopup.type === "loading"}
                                /> Add location
                            </label>
                            
                            {!isRemote && (
                                <input
                                    type="text"
                                    placeholder="Enter job location…"
                                    name="location"
                                    value={jobPostData.location.toLowerCase()}
                                    onChange={(e) => 
                                        handleInputChange(e, setJobData)
                                    }
                                    className="location-input"
                                    disabled={statusPopup.type === "loading"}
                                />
                            )}
                        </div>

                        <label>Salary</label>
                        <div className="salary-input-group">
                            <div className="salary-row">
                                <div className="salary-field">
                                    <input
                                        type="number"
                                        name="salary.min"
                                        value={jobPostData.salary?.min || ""}
                                        onChange={handleSalaryChange}
                                        placeholder="Min"
                                        min="0"
                                        disabled={statusPopup.type === "loading"}
                                    />
                                </div>
                                <span className="salary-separator">to</span>
                                <div className="salary-field">
                                    <input
                                        type="number"
                                        name="salary.max"
                                        value={jobPostData.salary?.max || ""}
                                        onChange={handleSalaryChange}
                                        placeholder="Max"
                                        min="0"
                                        disabled={statusPopup.type === "loading"}
                                    />
                                </div>
                            </div>
                            <label>Period</label>
                            <select 
                                name="salary.period"
                                value={jobPostData.salary?.period || "year"}
                                onChange={handleSalaryChange}
                                disabled={statusPopup.type === "loading"}
                            >
                                <option value="year">per year</option>
                                <option value="month">per month</option>
                                <option value="hour">per hour</option>
                            </select>
                            <label>Currency</label>
                            <select 
                                name="salary.currency"
                                value={jobPostData.salary?.currency || "USD"}
                                onChange={handleSalaryChange}
                                disabled={statusPopup.type === "loading"}
                            >
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="LBP">LBP (lbp)</option>
                            </select>
                        </div>

                        <button 
                            type="submit" 
                            className="submit-btn"
                            disabled={statusPopup.type === "loading"}
                        >
                            {statusPopup.type === "loading" ? (
                                <span className="button-loading">
                                    <div className="spinner"></div>
                                    Updating...
                                </span>
                            ) : "Update Job Post"}
                        </button>
                    </form>
                </div>
            </div>
        )
    }


    function renderJobContent(job) {
        const isDeletingThis = deleting.isDeleting && deleting.jobId === job.id
        
        return (
            <div className={`job-card ${isDeletingThis ? 'deleting' : ''}`}>
                <div className="profile-details">
                    <img src={job.createdBy.profileURL || defaultImage}/>
                    <p className="job-author">{job.createdBy.firstName || 'Unknown'} {job.createdBy.lastName || ''}</p>
                    {(user && (job.createdBy.authorId === user.uid || profile?.role === "admin")) &&
                        <div className="action-buttons">
                            <button 
                                className="delete-btn" 
                                onClick={() => deleteJobPost(job.id)}
                                disabled={isDeletingThis || statusPopup.type === "loading"}
                            >
                                {isDeletingThis ? (
                                    <span className="button-loading">
                                        <div className="spinner"></div>
                                        Deleting...
                                    </span>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22m-5-4H6a2 2 0 00-2 2v2h16V5a2 2 0 00-2-2z" />
                                        </svg>
                                        Delete
                                    </>
                                )}
                            </button>
                            <button 
                                className="edit-btn" 
                                onClick={() => handleEditMode(job)}
                                disabled={statusPopup.type === "loading"}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M16 3l5 5L7 22H2v-5L16 3z" />
                                </svg>
                                Edit
                            </button>
                        </div>
                    }
                </div>
                <h2 className="job-title">{job.title}</h2>
                <p className="job-description">{job.description}</p>
                <span>Requirements:</span>
                <ul className="requirement-list">
                    {job.requirements.map((requirement) => (
                        <li key={requirement}>{requirement}</li>
                    ))}
                </ul>
                {job.location && <p className="svg-content">
                    <svg xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width="20" height="20"
                        fill="none"
                        stroke="#7FB69E"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        class="icon icon-location">
                    <path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 1118 0z"></path>
                    <circle cx="12" cy="10" r="2.5"></circle>
                    </svg> 
                    {job.location}</p>
                }
                {job.salary && (job.salary.min || job.salary.max) && (
                    <p className="svg-content">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7FB69E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-dollar-sign w-4 h-4" aria-hidden="true">
                            <line x1="12" x2="12" y1="2" y2="22"></line>
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                        </svg>
                        {formatSalary(job.salary)}
                    </p>
                )}
                {job.jobType && <p className="svg-content">
                    <svg xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width="20" height="20"
                        fill="none"
                        stroke="#7FB69E"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        class="icon icon-briefcase">
                    <rect x="2" y="7" width="20" height="13" rx="2" ry="2"></rect>
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path>
                    <path d="M2 13h20"></path>
                    </svg>
                    {job.jobType}</p>
                }
                {job.applicationURL && urlIsValid && <p className="application-link"><span>Apply here:</span> <a href={`${job.applicationURL}`}>{job.applicationURL}</a></p>}
            </div>
        )
    }

    const activeFilterCount = () => {
        let count = 0
        if (filter.jobType !== "all") count++
        if (filter.location !== "all") count++
        if (filter.salaryMin) count++
        if (filter.salaryMax) count++
        return count
    }
    
    return(
        <>
        <StatusPopup 
            statusPopup={statusPopup} 
            onClose={hideStatus}
        />
        
        <Outlet context={{ 
                    resumeText: props.resumeText, 
                    allJobs: filteredJobs, 
                    db: db, 
                    user: user, 
                    jobEmbeddings: filteredJobs.map(job => job.jobEmbedding) 
         }}/>

        {!isRecommended && <div className="bodyContent">
            <div className="textContent">
                <h2>Find Your Next Opportunity</h2>
                <p>Discover jobs that match your skills and interests</p>
            </div>
            {!isRecommended && isCreatingPost===false && user && <button onClick={handlePostJob} className="create-btn">
                {statusPopup.type === "loading" && statusPopup.message === "Creating job post..." ? (
                    <span className="button-loading">
                        <div className="spinner"></div>
                        Creating...
                    </span>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#F4F5EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Post a Job
                    </>
                )}
            </button>}
        </div>}
        {!isRecommended && <div className="searchContainer">
            <svg xmlns="http://www.w3.org/2000/svg" 
                width="20" height="20" fill="none" stroke="currentColor" 
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
                className="search-icon">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
                type="text" 
                onChange={(e)=>setSearchText(e.target.value)} 
                placeholder= "Search Jobs..."
                className="searchInput"
                disabled={statusPopup.type === "loading" && statusPopup.message === "Searching jobs..."}
            />
            <button 
                onClick={handleSearchJobs} 
                className="searchBtn"
                disabled={statusPopup.type === "loading" && statusPopup.message === "Searching jobs..." || !searchText.trim()}
            >
                {statusPopup.type === "loading" && statusPopup.message === "Searching jobs..." ? (
                    <span className="button-loading">
                        <div className="spinner"></div>
                        Searching...
                    </span>
                ) : "Search"}
            </button> 
            <button 
                className="filterBtn" 
                onClick={()=>handleFiltering()}
                disabled={statusPopup.type === "loading"}
            >
                <svg xmlns="http://www.w3.org/2000/svg"
                    fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"
                    className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3 4.5h18M6 9.75h12M10 15h4M12 19.5v-4.5" />
                </svg>
                Filter
            </button>
        </div>}
        {!isRecommended && <div className="pageContainer">
            <div className="mainJobContainer">
                {statusPopup.type === "loading" && statusPopup.message === "Loading jobs..." ? (
                    <div className="loading-state">
                        <div className="spinner large"></div>
                        <p>Loading jobs...</p>
                    </div>
                ) : (
                    <>
                        {isFiltering && (
                        <div className="filterContainer">
                            <div className="filter-header">
                                <button onClick={()=>setFiltering(false)} className="back-btn">                                    
                                    Back
                                </button>
                                <h4>Filter Jobs</h4>
                                <p>Narrow down your job search</p>
                            </div>
                            
                            <div className="filter-section">
                                <h4>Job Type</h4>
                                <div className="filter-options">
                                    {['all', 'full time', 'part time', 'contract', 'internship', 'temporary', 'volunteer'].map(type => (
                                        <label key={type} className="filter-option">
                                            <input
                                                type="radio"
                                                name="jobType"
                                                value={type}
                                                checked={filter.jobType === type}
                                                onChange={(e) => setFilter(prev => ({...prev, jobType: e.target.value}))}
                                            />
                                            <span>{type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="filter-section">
                                <h4>Location</h4>
                                <div className="filter-options">
                                    {['all', 'remote', 'on-site'].map(location => (
                                        <label key={location} className="filter-option">
                                            <input
                                                type="radio"
                                                name="location"
                                                value={location}
                                                checked={filter.location === location}
                                                onChange={(e) => setFilter(prev => ({...prev, location: e.target.value}))}
                                            />
                                            <span>{location === 'all' ? 'All Locations' : 
                                                location === 'on-site' ? 'On-Site' : 
                                                location.charAt(0).toUpperCase() + location.slice(1)}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="filter-section">
                                <h4>Salary Range ($)</h4>
                                <div className="salary-range-inputs">
                                    <div className="salary-input">
                                        <label>Minimum</label>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={filter.salaryMin}
                                            onChange={(e) => setFilter(prev => ({...prev, salaryMin: e.target.value}))}
                                        />
                                    </div>
                                    <div className="salary-input">
                                        <label>Maximum</label>
                                        <input
                                            type="number"
                                            placeholder="Any"
                                            value={filter.salaryMax}
                                            onChange={(e) => setFilter(prev => ({...prev, salaryMax: e.target.value}))}
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            
                            <div className="filter-actions">
                                <button 
                                    onClick={handleClearFilters}
                                    className="clear-btn"
                                >
                                    Clear All
                                </button>
                                <button 
                                    onClick={handleApplyFilters}
                                    className="apply-btn"
                                    disabled={statusPopup.type === "loading"}
                                >
                                    {statusPopup.type === "loading" ? (
                                        <span className="button-loading">
                                            <div className="spinner"></div>
                                            Applying...
                                        </span>
                                    ) : `Apply Filters (${activeFilterCount()})`}
                                </button>
                            </div>
                        </div>
                    )}
                        <div className="jobContainer">
                            {!isRecommended && filteredJobs.map((Job)=>(
                                <article key={Job.id}>
                                    {renderJobContent(Job)}
                                </article>
                            ))}
                        </div>
                    </>
                )}
                {editing.isEditing && renderEditModal()}
                {isCreatingPost && 
                <div className="overlay">
                <div className="form-container">
                    <div className="bodyContent">
                        <div>
                            <h3>Post a New Job</h3>
                            <p>Fill in the details to create a new job listing</p>
                        </div>
                        <button onClick={handlePostJob} className="overlay-back-btn">x</button>
                    </div>
                    <form onSubmit={handleSubmitApplication} onKeyDown={(e) => {
                        if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
                            e.preventDefault()
                    }}} className="job-form">
                        <label>Title</label>
                        <input
                            type='text'
                            name='title'
                            value={jobPostData.title} 
                            onChange={(e)=> 
                                handleInputChange(e, setJobData)
                            }
                            placeholder="Title" 
                            required
                            disabled={statusPopup.type === "loading"}
                        />
                        <label>Description</label>
                        <textarea
                            name='description'
                            value={jobPostData.description} 
                            onChange={(e)=> 
                                handleInputChange(e, setJobData)
                            }
                            placeholder="Job Description" 
                            required
                            disabled={statusPopup.type === "loading"}
                        />
                        <label>Job Requirements</label>
                        <input 
                            type="text"
                            name="requirement"
                            onKeyDown={(e)=> {
                                if (e.key === "Enter") {
                                    e.preventDefault()
                                    addRequirement(e)
                                    e.target.value = ""
                                }}}
                            placeholder="Add job requirement…"
                            disabled={statusPopup.type === "loading"}
                        />
                        {jobPostData.requirements.length > 0 && <div className="requirements-skills-list">
                            {jobPostData.requirements.map(requirement => (
                                <span className="requirement-skill-item" key={requirement}>
                                    {requirement}
                                    <button 
                                        onClick={()=>deleteRequirement(requirement)} 
                                        className="deleteReq"
                                        disabled={statusPopup.type === "loading"}
                                    >x</button>
                                </span>
                            ))}
                        </div>}
                        <label>Application URL</label>
                        <input 
                            type="text" 
                            name="applicationURL"
                            value={jobPostData.applicationURL}
                            onChange={(e) => {
                                handleInputChange(e, setJobData)
                                setValidURL(isValidUrl(e.target.value))
                            }}
                            onBlur={(e)=> 
                                {!isValidUrl(e.target.value) &&
                                    setValidURL(false)
                                }
                            }
                            placeholder="Application URL" 
                            disabled={statusPopup.type === "loading"}
                        />
                        {!urlIsValid && <p>URL is not valid</p>}
                        
                        <label>Job Type</label>
                        <select 
                            name="jobType"
                            value={jobPostData.jobType}
                            onChange={(e)=> handleInputChange(e, setJobData)}
                            disabled={statusPopup.type === "loading"}
                        >
                            <option value="">Select Job Type</option>
                            <option value="full time">Full Time</option>
                            <option value="temporary">Temporary</option>
                            <option value="part time">Part Time</option>
                            <option value="contract">Contract</option>
                            <option value="volunteer">Volunteer</option>
                            <option value="internship">Internship</option>
                        </select>
                        
                        <label>Location</label>
                        <div className="choose-location">
                            <label>
                                <input 
                                    type="radio" 
                                    name="locationType" 
                                    value="remote" 
                                    checked={isRemote}
                                    onChange={handleLocationTypeChange}
                                    disabled={statusPopup.type === "loading"}
                                /> Remote 
                            </label>
                            <label>
                                <input 
                                    type="radio" 
                                    name="locationType" 
                                    value="custom" 
                                    checked={!isRemote}
                                    onChange={handleLocationTypeChange}
                                    disabled={statusPopup.type === "loading"}
                                /> Add location
                            </label>
                            
                            {!isRemote && (
                                <input
                                    type="text"
                                    placeholder="Enter job location…"
                                    name="location"
                                    value={jobPostData.location.toLowerCase()}
                                    onChange={(e) => 
                                        handleInputChange(e, setJobData)
                                    }
                                    className="location-input"
                                    disabled={statusPopup.type === "loading"}
                                />
                            )}
                        </div>

                        <label>Salary</label>
                        <div className="salary-input-group">
                            <div className="salary-row">
                                <div className="salary-field">
                                    <input
                                        type="number"
                                        name="salary.min"
                                        value={jobPostData.salary?.min || ""}
                                        onChange={handleSalaryChange}
                                        placeholder="Min"
                                        min="0"
                                        disabled={statusPopup.type === "loading"}
                                    />
                                </div>
                                <span className="salary-separator">to</span>
                                <div className="salary-field">
                                    <input
                                        type="number"
                                        name="salary.max"
                                        value={jobPostData.salary?.max || ""}
                                        onChange={handleSalaryChange}
                                        placeholder="Max"
                                        min="0"
                                        disabled={statusPopup.type === "loading"}
                                    />
                                </div>
                            </div>
                            <label>Period</label>
                            <select 
                                name="salary.period"
                                value={jobPostData.salary?.period || "year"}
                                onChange={handleSalaryChange}
                                disabled={statusPopup.type === "loading"}
                            >
                                <option value="year">per year</option>
                                <option value="month">per month</option>
                                <option value="hour">per hour</option>
                            </select>
                            <label>Currency</label>
                            <select 
                                name="salary.currency"
                                value={jobPostData.salary?.currency || "USD"}
                                onChange={handleSalaryChange}
                                disabled={statusPopup.type === "loading"}
                            >
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="LBP">LBP (lbp)</option>
                            </select>
                        </div>
                        <button 
                            type="submit" 
                            className="submit-btn"
                            disabled={statusPopup.type === "loading"}
                        >
                            {statusPopup.type === "loading" ? (
                                <span className="button-loading">
                                    <div className="spinner"></div>
                                    Creating...
                                </span>
                            ) : "Add Job Application"}
                        </button>
                    </form>
                </div>
                </div>
                }
                
            </div>
            <div className="sidebar">
                <div className="profile-sidebar">
                    {profile && (
                        <div className="profile-card">
                            <div id="profileHeader">
                                <svg xmlns="http://www.w3.org/2000/svg"
                                    fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"
                                    class="w-5 h-5">
                                <path stroke-linecap="round" stroke-linejoin="round"
                                    d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round"
                                    d="M4.5 19.5a8.25 8.25 0 0115 0v.75H4.5v-.75z" />
                                </svg>
                                <p>Your Profile</p>
                            </div>
                            <img src={profile?.profileURL || defaultImage} className="profile-pfp" />
                            <h3 className="profile-name">{profile?.firstName} {profile?.lastName}</h3>
                            <p className="profile-title">{profile?.professionTitle}</p>
                            <p>Head over to your profile to update your information</p>
                            <button onClick={()=> navigate("/app/profile")}>Go to profile</button>
                        </div>
                    )}
                </div>
                <div className="matchResumeCard">
                    <h3><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" 
                            fill="none" stroke="currentColor" stroke-width="2" 
                            stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2l1.5 3.5L17 7l-3.5 1.5L12 12l-1.5-3.5L7 7l3.5-1.5L12 2zM24 10l.75 1.75L27 12l-2.25.25L24 14l-.75-1.75L21 12l2.25-.25L24 10zM8 20l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/>
                        </svg>

                    AI Job Matching</h3>
                    <p>Get personalized job recommendations</p>
                    <p>Upload your resume in your profile, then click the Match button below to receive AI-powered job recommendations tailored to your skills and experience.</p>
                    <div className="matchCard-instructions">
                        <div id="uploadResume-instr">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path d="M12 2a1 1 0 0 1 1 1v9.59l2.3-2.3a1 1 0 0 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42L11 12.59V3a1 1 0 0 1 1-1zM5 18a1 1 0 0 0 0 2h14a1 1 0 0 0 0-2H5z"/>
                            </svg>
                            <span>Upload Resume</span>
                        </div>
                        <p>Go to Profile page</p>
                        <div id="match-instr">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path d="M12 2a10 10 0 1 0 7.07 2.93A10 10 0 0 0 12 2zm0 18a8 8 0 0 1-5.66-13.66A8 8 0 0 1 17.66 17.66 7.94 7.94 0 0 1 12 20zm1-10h2a1 1 0 0 1 0 2h-2v2a1 1 0 0 1-2 0v-2H9a1 1 0 0 1 0-2h2V8a1 1 0 0 1 2 0v2z"/>
                            </svg>
                            <span>Click Match</span>
                        </div>
                        <p>AI analyzes your profile</p>
                    </div>
                    <button onClick={()=>{
                        if (user) navigate("/app/jobs/recommended")
                        else props.triggerAuthPopup()
                    }}><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" 
                        fill="none" stroke="currentColor" stroke-width="2" 
                        stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2l1.5 3.5L17 7l-3.5 1.5L12 12l-1.5-3.5L7 7l3.5-1.5L12 2zM24 10l.75 1.75L27 12l-2.25.25L24 14l-.75-1.75L21 12l2.25-.25L24 10zM8 20l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/>
                    </svg>
                    Find Matching Jobs</button>
                    <p>Our AI will analyze your skills, experience, and preferences to recommend the best job opportunities for you.</p>
                </div>
            </div>
        </div>}
        </>
    )
}
