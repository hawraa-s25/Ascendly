
export default function StatusPopup({ statusPopup, onClose }){
    if (!statusPopup.show) return null

    return (
        <div className={`status-popup ${statusPopup.type}`}>
            <div className="status-popup-content">
                <div className="status-icon">
                    {statusPopup.type === "loading" && <div className="spinner"></div>}
                    {statusPopup.type === "success" && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    )}
                    {statusPopup.type === "error" && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    )}
                </div>
                <span className="status-message">{statusPopup.message}</span>
                {statusPopup.type !== "loading" && (
                    <button onClick={onClose} className="status-close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>
                )}
            </div>
        </div>
    )
}