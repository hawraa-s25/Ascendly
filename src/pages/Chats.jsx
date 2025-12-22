import React from "react"
import { realTimeDB } from "../firebase"
import { ref, push, onValue, off, update, get } from "firebase/database"
import "./Chats.css"
import defaultImage from "./defaultProfileImage.jpeg"
import StatusPopup from "./StatusPopup"
import { textTruncation } from "../commonFunctions"

export default function Chats(props){
    const auth = props.auth
    const user = auth.currentUser
    const [statusPopup, setStatusPopup] = React.useState({
        show: false,
        message: "",
        type: ""
    })

    if (!user) {
        return (
            <>
                <StatusPopup statusPopup={statusPopup} onClose={() => setStatusPopup({ show: false, message: "", type: "" })} />
                <div className="bodyContent">
                    <div className="textContent">
                        <h2>Messages</h2>
                        <p>Please sign in to view messages</p>
                    </div>
                </div>
            </>
        )
    }

    const userRef = ref(realTimeDB, "users/" + user.uid)
    const chatsRef = ref(realTimeDB, "chats")

    const [ chats, setChats ] = React.useState({})
    const [ activeChatId, setActiveChat ] = React.useState(null)
    const [ activeMessageId, setActiveMsg ] = React.useState(null)
    const [ messages, setMessages ] = React.useState([])
    const [ messageText, setText ] = React.useState("")
    const [ isChatting, setChatting ] = React.useState(false)
    const [ hasChosenChat, setChosen ] = React.useState(false)
    const [ isViewingChat, setViewingChat ] = React.useState(false)

    const messagesRef = ref(realTimeDB, `messages/${activeChatId}`)

    React.useEffect(() => {
        if (statusPopup.show && statusPopup.type !== "loading") {
            const timer = setTimeout(() => {
                setStatusPopup({ show: false, message: "", type: "" })
            }, statusPopup.type === "error" ? 5000 : 3000)
            
            return () => clearTimeout(timer)
        }
    }, [statusPopup])

    React.useEffect(() => {
        if (user && props.allProfiles) {
            const updateInChats = async () => {
                try {
                    const chatsSnapshot = await get(ref(realTimeDB, 'chats'))
                    const chatsData = chatsSnapshot.val()
                    
                    if (!chatsData) return
                    
                    const updates = {}

                    Object.entries(chatsData).forEach(([chatId, chat]) => {
                        if (chat.users && chat.users.some(u => u.uid === user.uid)) {
                            const currentUserProfile = props.allProfiles.find(p => p.userId === user.uid)
                            
                            if (!currentUserProfile) return

                            chat.users.forEach((userObj, index) => {
                                if (userObj.uid === user.uid) {
                                    if (userObj.firstName !== currentUserProfile.firstName || 
                                        userObj.lastName !== currentUserProfile.lastName ||
                                        userObj.profileURL !== currentUserProfile.profileURL) {
                                        
                                        updates[`chats/${chatId}/users/${index}/firstName`] = currentUserProfile.firstName || ""
                                        updates[`chats/${chatId}/users/${index}/lastName`] = currentUserProfile.lastName || ""
                                        
                                        if (currentUserProfile.profileURL) {
                                            updates[`chats/${chatId}/users/${index}/profileURL`] = currentUserProfile.profileURL
                                        }
                                    }
                                }
                            })
                        }
                    })

                    if (Object.keys(updates).length > 0) {
                        await update(ref(realTimeDB), updates)
                        console.log("Updated user info in chats")
                    }
                } catch (error) {
                    console.error("Error updating user info in chats:", error)
                }
            }
            
            updateInChats()
        }
    }, [user, props.allProfiles])

    const showStatus = (message, type = "loading") => {
        setStatusPopup({ show: true, message, type })
    }

    const hideStatus = () => {
        setStatusPopup({ show: false, message: "", type: "" })
    }
    
    React.useEffect(()=>{
        const cleanUpMessages = getMessage()
        return () => cleanUpMessages()
    }, [activeChatId])

    React.useEffect(()=>{
        const cleanUpChats = getChats()
        return () => cleanUpChats()
    }, [])

    function createChats(currentUserId, otherUserId){
        showStatus("Creating new chat...", "loading")
        try{
            const existingChat = Object.entries(chats).find(([chatId, chat]) => {
                if (!chat.users) return false
                const userIds = chat.users.map(u => u.uid)
                return userIds.includes(currentUserId) && userIds.includes(otherUserId)
            })

            if (existingChat) {
                const [existingChatId] = existingChat
                setActiveChat(existingChatId)
                setChosen(true)
                setViewingChat(true)
                setChatting(false)
                showStatus("Chat opened successfully!", "success")
                return
            }
            const currentUserProfile = props.allProfiles.find(p => p.userId === currentUserId)
            const otherUserProfile = props.allProfiles.find(p => p.userId === otherUserId)
            const newChatRef = push(chatsRef, {
                users: [{
                            uid: currentUserId,
                            firstName: currentUserProfile?.firstName || props.userInfo.firstName,
                            lastName: currentUserProfile?.lastName || props.userInfo.lastName,
                        },
                        {
                            uid: otherUserId,
                            firstName: otherUserProfile.firstName,
                            lastName: otherUserProfile.lastName,
                        }],
                lastMessage: {
                    text: "",
                    timestamp: 0
                },
                updatedAt: new Date().toLocaleTimeString(),
            })

            console.log("Created successfully")
            setChosen(true)
            setChatting(false)
            const chatId = newChatRef.key
            setActiveChat(chatId)
            showStatus("New chat created successfully!", "success")

        } catch (error){
            console.log(error.message)
            showStatus("Failed to create chat", "error")
        }
    }

    function handleMessageInput(e){
        setText(e.target.value)
    }

    function handleChatClick(chatId){
        setActiveChat(chatId)
        setChosen(true)
        setViewingChat(true)
        showStatus("Chat opened", "success")
    }

    function sendMessage(){
        if (!messageText.trim()) {
            showStatus("Please enter a message", "error")
            return
        }

        showStatus("Sending message...", "loading")
        try{
            const newMessagesRef = push(messagesRef, {
                senderId: user.uid,
                text: messageText,
                timestamp: new Date().toLocaleTimeString(),
                type: "text",
                attachmentURL: null
            })

            console.log("Message sent")
            setActiveMsg(newMessagesRef.key)
            Object.entries(chats).map(([chatId])=>{
                if (chatId === activeChatId){
                    update(ref(realTimeDB, `chats/${chatId}/`), { 
                        lastMessage: { 
                            text: messageText,
                            timestamp: new Date().toLocaleTimeString()
                        }
                    })
                }
            })

            setText("")
            showStatus("Message sent!", "success")

        }catch(error){
            console.error(error.message)
            showStatus("Failed to send message", "error")
        }
    }

    function getMessage(){
        onValue(messagesRef, (snapshot) => {
            const data = snapshot.val() || {}
            const messageArray = Object.entries(data).map(([id, msg]) => ({
                id,
                ...msg
            }))
            setMessages(prev => ({
                ...prev,
                [activeChatId]: messageArray
            }))
        })
        return () => off(messagesRef)
    }

    function getChats(){
        showStatus("Loading chats...", "loading")
        try {
            onValue(chatsRef, (snapshot) => {
                const data = snapshot.val() || {}
                setChats(data)
                showStatus("Chats loaded successfully!", "success")
            })
        } catch (error) {
            showStatus("Failed to load chats", "error")
        }
        return () => off(chatsRef)
    }

    return(
        <>
            <StatusPopup statusPopup={statusPopup} onClose={hideStatus} />
            
            <div className="bodyContent">
                <div className="textContent">
                    <h2>Messages</h2>
                    <p>Connect with employers and recruiters</p>
                </div>                
                <button 
                    className="create-btn"
                    onClick={() => setChatting(true)}
                    disabled={statusPopup.type === "loading"}
                >
                    {statusPopup.type === "loading" ? (
                        <span className="button-loading">
                            <div className="spinner"></div>
                            Loading...
                        </span>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#F4F5EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Start Chat
                        </>
                    )}
                </button>               
            </div>
            
            {isChatting && (
                <div className="overlay">
                    <div className="profiles-list-container">
                        <div className="bodyContent">
                            <div>
                                <h3>Start a New Conversation</h3>
                                <p>Choose a profile to start chatting with</p>
                            </div>
                            <button 
                                onClick={() => setChatting(false)} 
                                className="overlay-back-btn"
                                disabled={statusPopup.type === "loading"}
                            >x</button>
                        </div>
                        <ul className="chat-profiles-list">
                            {props.allProfiles
                            .filter(profile => profile.userId !== user.uid)
                            .map((profile, id) => (
                                <li key={id} className="profile-item">
                                    <img src={profile.profileURL || defaultImage} alt={`${profile.firstName}'s profile`}/>
                                    <div className="chat-profile-content">
                                        <h4 className="profile-name">{profile.firstName} {profile.lastName}</h4>
                                        <p>{profile.professionTitle}</p>
                                    </div> 
                                    <button
                                        className="new-chat-button"
                                        onClick={() => createChats(user.uid, profile.userId)}
                                        disabled={statusPopup.type === "loading"}
                                    >
                                        {statusPopup.type === "loading" ? "Creating..." : "New Chat"}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            <div className="chat-container">
                <div className="previous-chats-container">
                    <ul className="chats-list">
                        {Object.entries(chats)
                        .filter(([chatId, chat]) => chat?.users?.some(u => u.uid === user.uid))
                        .map(([chatId, chat]) =>{
                            const otherUser = chat.users.find(u => u.uid !== user.uid) 
                            return (
                                <li key={chatId} className="chat-item">
                                <button
                                    className="chat-button"
                                    onClick={() => handleChatClick(chatId)}
                                    disabled={statusPopup.type === "loading"}
                                >
                                    <div className="chat-info">
                                        {props.allProfiles.filter(profile => profile.userId === otherUser.uid)
                                        .map((profile, i)=>(
                                            <React.Fragment key={i}>
                                                <img src={profile.profileURL || defaultImage} alt={`${otherUser.firstName}'s profile`}/>
                                                <div className="chat-content">
                                                    <h3 className="chat-user">{otherUser.firstName} {otherUser.lastName}</h3>
                                                    <span> {chat.lastMessage && textTruncation(chat.lastMessage.text, 50)} </span>
                                                    <span className="chat-timestamp">
                                                        {chat.lastMessage && chat.lastMessage.timestamp}
                                                    </span>
                                                </div> 
                                            </React.Fragment>                                      
                                        ))}                   
                                    </div>
                                </button>
                                </li>
                        )})}
                    </ul>                    
                </div>

                {(hasChosenChat && activeChatId) ? (
                    <div className="chat-page">
                    <div className="chat-header">
                        {chats[activeChatId] && (
                        <>
                            {(() => {
                            const chat = chats[activeChatId]
                            const otherUser = chat.users.find(u => u.uid !== user.uid)
                            return (
                                <h3>{otherUser.firstName} {otherUser.lastName}</h3>
                            )
                            })()}
                        </>
                        )}
                    </div>
                    <div className="messages-container">
                        {messages[activeChatId]?.map(msg => { 
                            return (
                            <div 
                                key={msg.id} 
                                className={`message-item ${msg.senderId === user.uid ? "my-message" : "other-message"}`}
                            >
                                <span className="message-text">{msg.text}</span>
                                <p>{msg.timestamp}</p>
                            </div>
                        )})}
                    </div>
                    <div className="message-input-container">
                        <input 
                            type="text" 
                            id="messageInput"
                            className="message-input"
                            value={messageText}
                            onChange={(e) => handleMessageInput(e)}
                            placeholder="Type a message..."
                            disabled={statusPopup.type === "loading"}
                        />
                        <button 
                            className="send-message-button" 
                            onClick={sendMessage}
                            disabled={statusPopup.type === "loading" || !messageText.trim()}
                        >
                            {statusPopup.type === "loading" ? (
                                <div className="spinner small"></div>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="#F6F1E8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 25 18">
                                    <path d="M22 2 11 13"></path>
                                    <path d="M22 2 15 22 11 13 2 9z"></path>
                                </svg>
                            )}
                        </button>
                    </div>
                    </div>
                ) : <div className="default-chat-page">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" stroke="#7FB69E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="-3 -6 30 30">
                            <path d="M20 2H4a2 2 0 0 0-2 2v14l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
                        </svg>
                        <h4>Your Messages</h4>
                        <p>Select a conversation from the list or start a new chat to connect with employers and recruiters</p>
                    </div>}
            </div>
        </>
    )
}
