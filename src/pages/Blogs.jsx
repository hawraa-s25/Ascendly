import React from "react"
import "./media.css"
import { 
    doc, 
    collection, 
    updateDoc, 
    onSnapshot, 
    addDoc,
    deleteDoc
} from "firebase/firestore"
import {
    ref, 
    uploadBytes, 
    getDownloadURL,
    deleteObject
} from "firebase/storage"
import "../App.css"
import { 
    addItemToDatabase, 
    fetchItemData, 
    deletePost,
    handleInputChange,
    resetPostData,
    editPost,
    calculateSimilarity,
    uploadImages
} from "../commonFunctions"
import { summarizedBlog, createEmbeddings } from "../firebase"
import "./Blogs.css"
import defaultImage from "./defaultProfileImage.jpeg"
import { useNavigate } from "react-router-dom"
import StatusPopup from "./StatusPopup"

export default function Blogs(props){
    const user=props.auth.currentUser
    const db=props.db
    const storage=props.storage
    const collectionName="blogs"
    const profile = user ? props.allProfiles.find(profile => profile.userId === user.uid) : null
    const navigate = useNavigate()
    
    const [blogPostData, setBlogData] = React.useState({
        title: "",
        content: "",
        tags: [],
        imageURLs: [],
        createdBy: {
            authorId: user?.uid || "Anonymous",
            firstName: profile?.firstName || "",
            lastName: profile?.lastName || "",
            profileURL: profile?.profileURL || ""
        },
        summary: "",
        isSummaryReady: false,
        blogEmbedding: []
    })
    const [loadingImages, setLoadingImages] = React.useState(false)
    const [deletedImages, setDeletedImages] = React.useState([])
    const [isCreatingPost, setCreating] = React.useState(false)
    const [allBlogs, setAllBlogs] = React.useState([])
    const [editing, setEditing] = React.useState({
        blogID: "",
        isEditing: false
    })
    const [deleting, setDeleting] = React.useState({
        blogId: "",
        isDeleting: false
    })
    const [ searchText, setSearchText ] = React.useState("")
    const [currentIndex, setCurrentIndex] = React.useState(0)
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
        const loadBlogs = async () => {
            showStatus("Loading blogs...", "loading")
            try {
                const unsubscribe = fetchItemData(collectionName, setAllBlogs)
                showStatus("Blogs loaded successfully!", "success")
                return () => unsubscribe()
            } catch (error) {
                console.error(error)
                showStatus("Failed to load blogs", "error")
            }
        }
        loadBlogs()
    }, [])

    React.useEffect(()=>{
        if(user && profile?.profileURL){
            const updateProfileURLInDocs = async () => {
                const blogsRef = collection(db, "blogs")
                onSnapshot(blogsRef, async (snapshot) => {
                    snapshot.docs.forEach(async (docSnap) => {
                        const blog = docSnap.data()
                        if(blog.createdBy?.authorId === user.uid && blog.createdBy?.profileURL !== profile.profileURL){
                            await updateDoc(doc(db, "blogs", docSnap.id), {
                                "createdBy.profileURL": profile.profileURL
                            })
                        }
                    })
                })
            }
            updateProfileURLInDocs()
        }
    }, [profile?.profileURL, user])

    function handleCreatePostBtn(){
        setCreating(prev => !prev)
        setBlogData(resetPostData("blog", { uid: user.uid, ...props.userInfo }))
        hideStatus()
    }

    function handleEditMode(blog){ 
        setEditing({ blogID: blog.id, isEditing: true }) 
        setBlogData(JSON.parse(JSON.stringify(blog))) 
        hideStatus()
    } 
    
    function handleCancelEdit(){ 
        setEditing((prev)=>({ ...prev, isEditing:false }))
        setBlogData(resetPostData("blog", { uid: user.uid, ...props.userInfo })) 
        hideStatus()
    }

    function handleDeleteImage(url){ 
        setBlogData((prev)=>({ ...prev, imageURLs: prev.imageURLs.filter((img) => img !== url) })) 
        setDeletedImages((prev) => [...prev, url])
    }

    async function handleSubmit(e){
        e.preventDefault()
        if(loadingImages) return alert("Wait until images are uploaded")
        
        showStatus("Creating blog post...", "loading")
        
        try {
            const finalBlogData = { 
                ...blogPostData,
                createdBy: {
                    authorId: user.uid,
                    firstName: profile?.firstName || "",
                    lastName: profile?.lastName || "",
                    profileURL: profile?.profileURL || ""
                }
            }
            const docRef = await addItemToDatabase(collectionName, finalBlogData)
            try {
                /*const blogEmbedding = await createEmbeddings({ text: blogPostData.content })
                await updateDoc(doc(db, collectionName, docRef.id), { 
                    blogEmbedding: blogEmbedding.data.embedding 
                })*/
                const blogEmbedding = await createEmbeddings(blogPostData.content)
                if (blogEmbedding && blogEmbedding.embedding) {
                    await updateDoc(doc(db, collectionName, docRef.id), { 
                        blogEmbedding: blogEmbedding.embedding 
                    })
                }
            } catch (embeddingError) {
                console.warn("Embedding creation failed, but blog was created:", embeddingError)
            }

            setBlogData(resetPostData("blog", { uid: user.uid, ...props.userInfo }))
            setCreating(false)
            showStatus("Blog post created successfully!", "success")

        } catch(error) {
            console.error("Blog creation failed:", error)

            let errorMessage = "Failed to create blog"
            if (error.code === 'unavailable') {
                errorMessage = "Network error. Please check your connection"
            }
            
            showStatus(errorMessage, "error")
        }
    }

    async function handleImageChange(e){
        showStatus("Uploading images...", "loading")
        try {
            const files = Array.from(e.target.files)
            const urls = await Promise.all(files.map(file => uploadImages(file)))
            setBlogData(prev => ({ ...prev, imageURLs: [...prev.imageURLs, ...urls.filter(Boolean)] }))
            showStatus("Images uploaded successfully!", "success")
        } catch(error){
            console.error(error)
            showStatus("Failed to upload images", "error")
        }
    }

    async function deleteBlogPost(docID, urls){
        setDeleting({ blogId: docID, isDeleting: true })
        showStatus("Deleting blog post...", "loading")
        
        try {
            await deletePost(collectionName, docID)
            if (urls && urls.length > 0) {
                Promise.allSettled(
                    urls.map(async (url) => {
                        try {
                            const path = decodeURIComponent(url.substring(url.indexOf("/o/")+3, url.indexOf("?")))
                            await deleteObject(ref(storage, path))
                        } catch (imageError) {
                            console.warn("Failed to delete image:", imageError)
                        }
                    })
                ).catch(console.error)
            }
            
            showStatus("Blog post deleted successfully!", "success")
        } catch(error){
            console.error(error)
            
            let errorMessage = "Failed to delete blog"
            if (error.code === 'not-found') {
                errorMessage = "Blog not found"
            }
            
            showStatus(errorMessage, "error")
        } finally {
            setDeleting({ blogId: "", isDeleting: false })
        }
    }

    async function editBlogPost(e){
        e.preventDefault()
        showStatus("Updating blog post...", "loading")
        
        try {
            const updatedDoc = {
                title: blogPostData.title,
                content: blogPostData.content,
                imageURLs: blogPostData.imageURLs,
                createdBy: blogPostData.createdBy
            }
            
            await editPost(collectionName, blogPostData, updatedDoc, setEditing, "blogID")
            
            if (deletedImages.length > 0) {
                Promise.allSettled(
                    deletedImages.map(async (url) => {
                        try {
                            const path = decodeURIComponent(url.substring(url.indexOf("/o")+3, url.indexOf("?")))
                            await deleteObject(ref(storage, path))
                        } catch (imageError) {
                            console.warn("Failed to delete old image:", imageError)
                        }
                    })
                ).catch(console.error)
            }
            
            setDeletedImages([])
            setEditing({ blogID: "", isEditing: false })
            showStatus("Blog post updated successfully!", "success")
            
        } catch(error){
            console.error(error)
            
            let errorMessage = "Failed to update blog"
            if (error.code === 'not-found') {
                errorMessage = "Blog not found"
            }
            
            showStatus(errorMessage, "error")
        }
    }

    /*async function handleSummarize(blogContent, blogId){
        showStatus("Generating summary...", "loading")
        try {
            const blog = allBlogs.find(b => b.id === blogId)
            if(!blog) throw new Error("Blog not found")
            
            if(!blog.summary){
                const result = await summarizedBlog({ content: blogContent })
                setAllBlogs(prev => prev.map(b => b.id===blogId ? {...b, summary: result.data.summary, isSummaryReady: true} : b))
                showStatus("Summary generated successfully!", "success")
            } else {
                setAllBlogs(prev => prev.map(b => b.id===blogId ? {...b, isSummaryReady: !b.isSummaryReady} : b))
                hideStatus()
            }
        } catch(error){
            console.error(error)
            showStatus("Failed to generate summary", "error")
        }
    }*/

    async function handleSummarize(blogContent, blogId){
        showStatus("Generating summary...", "loading")
        try {
            const blog = allBlogs.find(b => b.id === blogId)
            if(!blog) throw new Error("Blog not found")
            
            if(!blog.summary){
                const result = await summarizedBlog(blogContent)
                if (!result || !result.summary) {
                    throw new Error("No summary returned from API")
                }
                
                setAllBlogs(prev => prev.map(b => b.id===blogId ? {...b, summary: result.summary, isSummaryReady: true} : b))
                showStatus("Summary generated successfully!", "success")
            } else {
                setAllBlogs(prev => prev.map(b => b.id===blogId ? {...b, isSummaryReady: !b.isSummaryReady} : b))
                hideStatus()
            }
        } catch(error){
            console.error("Summary error:", error)
            showStatus("Failed to generate summary: " + (error.message || "Unknown error"), "error")
        }
    }

    async function searchBlog(){
        if (!searchText.trim()) {
            showStatus("Please enter search text", "error")
            return
        }
        
        showStatus("Searching blogs...", "loading")
        try{
            const queryEmbedding = await createEmbeddings(searchText)
            if (queryEmbedding && queryEmbedding.embedding) {
                calculateSimilarity(allBlogs, "blogEmbedding", queryEmbedding.embedding, setAllBlogs)
            } else {
                throw new Error("Failed to generate embeddings for search")
            }
            showStatus(`Search completed for "${searchText}"`, "success")
        } catch(error){
            console.error(error)
            showStatus("Search failed", "error")
        }
    }

    function renderEditModal() {
        if (!editing.isEditing) return null
        
        return (
            <div className="overlay">
                <div className="form-container">
                    <div className="bodyContent">
                        <div>
                            <h3>Edit Post</h3>
                            <p>Update your post content</p>
                        </div> 
                        <button onClick={handleCancelEdit} className="overlay-back-btn">x</button>
                    </div>
                    
                    <form onSubmit={(e)=>editBlogPost(e)}>
                        <label>Title</label>
                        <input
                            type='text'
                            name='title'
                            value={blogPostData.title} 
                            onChange={(e)=> handleInputChange(e, setBlogData)}
                            placeholder="Title" 
                            required
                            disabled={statusPopup.type === "loading"}
                        />
                        <label>Content</label>
                        <textarea
                            name='content'
                            value={blogPostData.content} 
                            onChange={(e)=> handleInputChange(e, setBlogData)}
                            placeholder="Content" 
                            maxLength={4000}
                            required
                            disabled={statusPopup.type === "loading"}
                        />
                        <label>Images</label>
                        <div className="image-upload">
                            <input 
                                type="file" 
                                accept="image/*" 
                                multiple 
                                onChange={handleImageChange}
                                disabled={statusPopup.type === "loading"}
                            /> 
                        </div>
                        <div className="display-images">
                            {blogPostData.imageURLs.map((url, i) => (
                                <div key={i} className="image-item">
                                    <img src={url} alt={`Blog image ${i + 1}`} />
                                    <button 
                                        onClick={() => handleDeleteImage(url)}
                                        disabled={statusPopup.type === "loading"}
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button 
                            type="submit" 
                            disabled={statusPopup.type === "loading"}
                            className={statusPopup.type === "loading" ? 'loading' : ''}
                        >
                            {statusPopup.type === "loading" ? (
                                <span className="button-loading">
                                    <div className="spinner"></div>
                                    Updating...
                                </span>
                            ) : "Update Blog Post"}
                        </button>
                    </form>
                </div>
            </div>
        )
    }

    function renderBlogContent(blog) {
        const isDeletingThis = deleting.isDeleting && deleting.blogId === blog.id
        const isSummarizingThis = statusPopup.type === "loading" && statusPopup.message === "Generating summary..."
        
        return (
            <div className={`blog-card ${isDeletingThis ? 'deleting' : ''}`}>
                <div className="profile-details">
                    <img src={blog.createdBy.profileURL || defaultImage} alt="Author profile" />
                    <p className="author">{blog.createdBy.firstName || 'Unknown'} {blog.createdBy.lastName || ''}</p>
                    {(user && (blog.createdBy.authorId === user.uid || profile?.role === "admin")) && 
                        <div className='action-buttons'>
                            <button 
                                onClick={()=>deleteBlogPost(blog.id, blog.imageURLs)} 
                                className="delete-btn"
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
                                onClick={()=>handleEditMode(blog)} 
                                className="edit-btn"
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
                <h2 className='blog-title'>{blog.title}</h2>
                <p className='blog-content'>{!blog.isSummaryReady ? blog.content: blog.summary}</p>
                
                {blog.imageURLs.length > 0 && (
                    <div className="images-wrapper">
                        <button 
                            className="arrow left" 
                            onClick={()=>setCurrentIndex(prev => Math.max(prev - 1, 0))}
                            disabled={currentIndex === 0}
                        >‹</button>
                        <div className='blog-images' style={{ transform: `translateX(-${currentIndex * 50}%)` }}>
                            {blog.imageURLs.map((url, i) => (
                                <a href={url} target="_blank" rel="noopener noreferrer" key={i}>
                                    <img src={url} alt={`Blog image ${i + 1}`}/>
                                </a>
                            ))}
                        </div>    
                        <button 
                            className="arrow right" 
                            onClick={()=>setCurrentIndex(prev => Math.min(prev + 1, Math.ceil(blog.imageURLs.length / 2) - 1))}
                            disabled={currentIndex === Math.ceil(blog.imageURLs.length / 2) - 1}
                        >›</button>          
                    </div>
                )}
                
                <button 
                    onClick={()=>handleSummarize(blog.content, blog.id)} 
                    className="summarizeBtn"
                    disabled={isSummarizingThis}
                >
                    {isSummarizingThis ? (
                        <span className="button-loading">
                            <div className="spinner"></div>
                            Summarizing...
                        </span>
                    ) : blog.isSummaryReady ? "Show Full Content" : "Summarize"}
                </button>
            </div>
        )
    }

    return(
        <>
        <StatusPopup 
            statusPopup={statusPopup} 
            onClose={hideStatus}
        />
        
        <div className="bodyContent">
            <div className="textContent">
                <h2>Career Insights & Tips</h2>
                <p>Stay informed with the latest career advice and industry trends</p>
            </div>
            
            {isCreatingPost===false && user && (
                <button onClick={handleCreatePostBtn} className="create-btn">
                    {statusPopup.type === "loading" && statusPopup.message === "Creating blog post..." ? (
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
                            Create a Post
                        </>
                    )}
                </button>
            )}
        </div>

        <div className="searchContainer">
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
                placeholder="Search Blogs..."
                disabled={statusPopup.type === "loading" && statusPopup.message === "Searching blogs..."}
            />
            <button 
                onClick={searchBlog} 
                className="searchBlogBtn"
                disabled={statusPopup.type === "loading" && statusPopup.message === "Searching blogs..." || !searchText.trim()}
            >
                {statusPopup.type === "loading" && statusPopup.message === "Searching blogs..." ? (
                    <span className="button-loading">
                        <div className="spinner"></div>
                        Searching...
                    </span>
                ) : "Search"}
            </button>
        </div>
        
        <div className="pageContainer">
            <div className="mainBlogContainer">
                {statusPopup.type === "loading" && statusPopup.message === "Loading blogs..." ? (
                    <div className="loading-state">
                        <div className="spinner large"></div>
                        <p>Loading blogs...</p>
                    </div>
                ) : (
                    <div className="blogContainer">
                        {allBlogs.map((Blog,i)=>(
                            <article key={i}>{renderBlogContent(Blog)}</article>
                        ))}
                    </div>
                )}

                {editing.isEditing && renderEditModal()}
                
                {isCreatingPost && (
                <div className="overlay"> 
                    <div className="form-container">
                        <div className="bodyContent">
                            <div>
                                <h3>Write a New Post</h3>
                                <p>Share your insights and advice with the community</p>
                            </div>
                            <button onClick={handleCreatePostBtn} className="overlay-back-btn">x</button>
                        </div>
                        
                        <form onSubmit={handleSubmit}>
                            <label>Title</label>
                            <input
                                type='text'
                                name='title'
                                value={blogPostData.title} 
                                onChange={(e)=> handleInputChange(e, setBlogData)}
                                placeholder="Title" 
                                required
                                disabled={statusPopup.type === "loading"}
                            />
                            <label>Content</label>
                            <textarea
                                name='content'
                                value={blogPostData.content} 
                                onChange={(e)=> handleInputChange(e, setBlogData)}
                                placeholder="Content" 
                                maxLength={4000}
                                required
                                disabled={statusPopup.type === "loading"}
                            />
                            <label>Images</label>
                            <div className="image-upload">
                               <input 
                                    type="file" 
                                    accept="image/*" 
                                    multiple 
                                    onChange={handleImageChange}
                                    disabled={statusPopup.type === "loading"}
                                /> 
                            </div>
                            <div className="display-images">
                                {blogPostData.imageURLs.map((url, i) => (
                                    <div key={i} className="image-item">
                                        <img src={url} alt={`Blog image ${i + 1}`} />
                                        <button 
                                            onClick={() => handleDeleteImage(url)}
                                            disabled={statusPopup.type === "loading"}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button 
                                type="submit" 
                                disabled={statusPopup.type === "loading"}
                                className={statusPopup.type === "loading" ? 'loading' : ''}
                            >
                                {statusPopup.type === "loading" && statusPopup.message === "Creating blog post..." ? (
                                    <span className="button-loading">
                                        <div className="spinner"></div>
                                        Creating...
                                    </span>
                                ) : "Add Blog"}
                            </button>
                        </form>
                    </div>
                </div>)}
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
        </div>
    </>
    )
}

