import pdf from "pdf-extraction"

export default async function handler(req, res) {
  const { fileData } = req.body

  const buffer = Buffer.from(fileData, 'base64')
  const extractedData = await pdf(buffer)
  
  res.json({ extractedText: extractedData.text })
}