import { OpenAI } from "openai"

export default async function handler(req, res) {
  // CORS handled automatically!
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { content } = req.body

  if (!content) {
    return res.status(400).json({ error: "Missing content" })
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are a professional summarizer..."
      },
      { role: "user", content }
    ],
    temperature: 0.3
  })

  res.json({ summary: response.choices[0].message.content })
}