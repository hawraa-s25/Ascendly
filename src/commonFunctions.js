import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage, auth } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot
} from "firebase/firestore";

export async function addItemToDatabase(collectionName,data){
    try{
        const docRef = await addDoc(collection(db, collectionName), data)
        console.log("Document written with ID: ", docRef.id)
        return docRef
    }catch(error){
        console.error("Error:", error.message)
    }
}

export function fetchItemData(collectionName, setAllData) {
    try{
        const collectionRef = collection(db, collectionName)
        return onSnapshot(collectionRef,(snap)=>{
            if (!snap.empty){
                const allData = snap.docs.map( doc => ({ id: doc.id, ...doc.data() }))
                setAllData(allData)
            }
            console.log("fetched")
        })  
    }catch(error){
        console.error("Error:", error.message)
    }
}

export function deletePost(collectionName, docID){
    try{
        deleteDoc(doc(db,collectionName,docID))
        console.log("deleted")
    }catch(error){
        console.error("Error:", error.message)
    }
}

export function handleInputChange(event, setData) {
    const { name, value } = event.target;
    setData(prev => ({ ...prev, [name]: value }));
}

export function resetPostData(type, userInfo) {
    const base = {
        title: "",
        createdBy: {
            authorId: userInfo.uid,
            firstName: userInfo.firstName,
            lastName: userInfo.lastName
        }
    }
    if (type === "blog") {
        return {
            content: "",
            tags: [],
            imageURLs: [],
            ...base
        }
    }
    if (type === "job") {
        return {
            description: "",
            requirements: [],
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
            ...base
        }
    }
}

export async function editPost(collectionName, document, updatedDoc, setEditing, editingKey){
    try{
        const postRef = doc(db, collectionName, document.id)
        await updateDoc(postRef, updatedDoc)
        setEditing({
            [editingKey]: document.id,
            isEditing: false
        })
    }catch(error){
        console.error(error.message)
    }
}

export function cosineSimilarity(a, b) {

    if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) {
        console.warn("Invalid embeddings passed to cosineSimilarity:", { a, b })
        return 0
    }

    const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0)
    const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0))
    const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0))
    return dot / (magA * magB)
}

export function calculateSimilarity(allData, embedding, queryEmbedding, setAllData){
    const results = allData
                    .filter(data => Array.isArray(data[embedding]) && data[embedding].length > 0)
                    .map( data => {
        const similarity = cosineSimilarity(queryEmbedding, data[embedding])
        return {...data, similarity}
    })
    const searchedResults = results.filter(data => data.similarity > 0.7).sort((a,b) => b.similarity - a.similarity)
    setAllData(searchedResults)
}

export async function uploadImages(file){
    const user = auth.currentUser;
    const fileRef = ref(storage,`uploads/${user.uid}/${file.name}`)
    try{
        await uploadBytes(fileRef, file)
        console.log("Image downloaded")
        const imageUrl = await getDownloadURL(fileRef)
        console.log("Image gotten")
        return imageUrl
    } catch(error){
        console.error("Error: ", error.message)
        return null
    }

}
