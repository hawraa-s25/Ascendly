import { OpenAI } from "openai"

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "Missing or invalid text input" });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Simple text chunking without LangChain
    function chunkText(text, chunkSize = 500, overlap = 50) {
      const words = text.split(' ');
      const chunks = [];
      
      for (let i = 0; i < words.length; i += chunkSize - overlap) {
        const chunk = words.slice(i, i + chunkSize).join(' ');
        if (chunk.trim().length > 0) {
          chunks.push(chunk);
        }
      }
      return chunks;
    }

    const texts = chunkText(text);

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: texts.length > 0 ? texts : [text] // Fallback to original text if no chunks
    });

    const embedding = embeddingResponse.data[0].embedding;

    return res.status(200).json({ 
      embedding,
      chunks: texts.length // For debugging
    });

  } catch (error) {
    console.error("OpenAI embedding error:", error);
    return res.status(500).json({ error: "Embedding generation failed: " + error.message });
  }
}
