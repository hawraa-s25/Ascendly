import { OpenAI } from "openai"

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { content } = req.body

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ error: "Missing or invalid content" })
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a professional summarizer specialized in career development content. Given a long article, extract and condense its core message into a concise, engaging, and informative paragraph. Do not use bullet points. The summary should read naturally, like a short editorial or blog intro, and should highlight the most important ideas, insights, or advice from the original content, and should always be shorter or with less words than the original content. Avoid generic or filler phrases. If there is no content or if the content is not a sentence or gibberish, reply with 'Sorry there is nothing to summarize'"
        },
        {
          role: "user",
          content: content
        }
      ],
      temperature: 0.3
    })

    const summary = response.choices[0].message.content
    
    return res.status(200).json({ summary })

  } catch (error) {
    console.error("OpenAI API error:", error)
    
    // Better error handling
    let errorMessage = "OpenAI API request failed"
    if (error.response) {
      errorMessage = `OpenAI error: ${error.response.status} - ${error.response.statusText}`
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return res.status(500).json({ 
      error: errorMessage,
      details: "Check if OPENAI_API_KEY is set correctly"
    })
  }
}
