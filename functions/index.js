import admin from "firebase-admin"
import { onCall, HttpsError } from "firebase-functions/v2/https"
import { defineSecret } from "firebase-functions/params"
import pdf from "pdf-extraction"
import OpenAI from "openai"
import { CharacterTextSplitter } from "langchain/text_splitter"

admin.initializeApp()

const openaiKey = defineSecret("OPENAI_API_KEY")
const storage = admin.storage()
const bucket = storage.bucket()

export const summarizedBlog = onCall({ timeoutSeconds: 90, secrets: [openaiKey] }, async (data, context) => {
    const openai = new OpenAI({
      apiKey: openaiKey.value()
    })

    const content = data?.content || data?.data?.content
    if (!content || typeof content !== "string" || content.trim().length === 0) {
        throw new HttpsError("invalid-argument", "Missing or invalid content")
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
            {
                role: "system",
                content:
                "You are a professional summarizer specialized in career development content. Given a long article, extract and condense its core message into a concise, engaging, and informative paragraph. Do not use bullet points. The summary should read naturally, like a short editorial or blog intro, and should highlight the most important ideas, insights, or advice from the original content, and should always be shorter or with less words than the original content. Avoid generic or filler phrases. If there is no content or if the content is not a sentence or gibberish, reply with 'Sorry there is nothing to summarize'"
            },
            {
                role: "user",
                content: content
            }
            ],
            temperature: 0.3
        })

        const summary = response.choices[0].message.content
        return { summary }
    } catch (error) {
        console.error("OpenAI chat error:", error)
        throw new HttpsError("internal", error.message || "Chat completion failed")
    }
})

export const extractData = onCall({ timeoutSeconds: 90 }, async (data, context) => {
    const userId = data?.data?.userId
    const fileName = data?.data?.fileName

    if (!userId || !fileName) {
        throw new HttpsError("invalid-argument", "Missing userId or fileName")
    }

    const fileRef = bucket.file(`uploads/${userId}/${fileName}`)

    try {
        const [buffer] = await fileRef.download()
        console.log("File downloaded, starting PDF extraction...")
        const fileData = await pdf(buffer)
        console.log("Extracted text:", fileData.text)
        return { extractedText: fileData.text }
    } catch (error) {
        console.error("PDF parsing error:", error)
        throw new HttpsError("internal", "PDF parsing failed")
    }
})


export const createEmbeddings = onCall({ timeoutSeconds: 90, secrets: [openaiKey] }, async (requestData, context) => {

    try {
        const text = requestData?.text || requestData?.data?.text
        if (!text || typeof text !== "string" || text.trim().length === 0) {
            throw new HttpsError("invalid-argument", "Missing or invalid text input")
        }

        const openai = new OpenAI({
            apiKey: openaiKey.value()
        })

        const splitter = new CharacterTextSplitter({
            separator: " ",
            chunkSize: 500,
            chunkOverlap: 50,
        })
        
        const output = await splitter.createDocuments([text])
        const texts = output.map(doc => doc.pageContent)

        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: texts
        })

        const embedding = embeddingResponse.data[0].embedding

        return { embedding }

    } catch (error) {
        console.error("OpenAI embedding error:", error)
        if (error.response) {
            console.error("OpenAI response data:", error.response.data)
        }
        throw new HttpsError("internal", "Embedding generation failed")
    }
})
