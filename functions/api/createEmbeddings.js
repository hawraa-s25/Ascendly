import { OpenAI } from "openai"
import { CharacterTextSplitter } from "langchain/text_splitter"

export default async function handler(req, res) {
  const { text } = req.body

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
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

  res.json({ embedding: embeddingResponse.data[0].embedding })
}