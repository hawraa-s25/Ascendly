// /pages/api/extractData.js
import pdf from "pdf-extraction"
import mammoth from "mammoth"

export default async function handler(req, res) {
  // Set CORS headers for Vercel deployment
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { fileData, fileType, fileName } = req.body
    if (!fileData) {
      return res.status(400).json({ 
        success: false,
        error: "No file data provided. Please select a file." 
      })
    }

    const buffer = Buffer.from(fileData, 'base64')
    let extractedText = ""
    const extension = fileType || 
                     (fileName ? fileName.split('.').pop().toLowerCase() : 'unknown')

    switch (extension) {
      case 'pdf':
        try {
          const pdfData = await pdf(buffer)
          extractedText = pdfData.text || ""
        } catch (pdfError) {
          console.error("PDF processing error:", pdfError)
          throw new Error(`Failed to process PDF: ${pdfError.message}`)
        }
        break

      case 'docx':
      case 'doc':
        try {
          const result = await mammoth.extractRawText({ 
            buffer: buffer,
          })
          extractedText = result.value || ""
          if (result.messages && result.messages.length > 0) {
            console.log("Mammoth processing messages:", result.messages)
          }
        } catch (docError) {
          if (extension === 'doc') {
            throw new Error(
              "Unable to process this .doc file. " +
              "Some older .doc formats may not be supported. " +
              "Please try converting to PDF or .docx format."
            )
          }
          throw new Error(`Failed to process Word document: ${docError.message}`)
        }
        break

      default:
        return res.status(400).json({ 
          success: false,
          error: `Unsupported file type: .${extension}. ` +
                 `Supported formats: PDF (.pdf), Word (.doc, .docx)` 
        })
    }

    const cleanedText = extractedText
      .replace(/\s+/g, ' ')     
      .replace(/\s+\./g, '.')   
      .replace(/\s+,/g, ',')    
      .trim()                   

    if (!cleanedText || cleanedText.length < 10) {
      return res.status(400).json({ 
        success: false,
        error: "Could not extract readable text from the document. " +
               "The file may be empty, corrupted, image-based, or password protected." 
      })
    }

    res.status(200).json({ 
      success: true,
      extractedText: cleanedText,
      fileType: extension,
      characterCount: cleanedText.length
    })

  } catch (error) {
    console.error("Document processing error:", error)

    let errorMessage = error.message || "An unknown error occurred"
    let statusCode = 500

    if (error.message.includes("Unsupported") || 
        error.message.includes("No file data")) {
      statusCode = 400
    } else if (error.message.includes("corrupt") || 
               error.message.includes("Could not extract")) {
      statusCode = 422
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    })
  }
}
