import pdf from "pdf-extraction"
import mammoth from "mammoth"

export default async function handler(req, res) {
  try {
    const { fileData, fileType, fileName } = req.body
    if (!fileData) {
      return res.status(400).json({ 
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
  }
}
