import OpenAI from "openai";

const JSON_SCHEMA = `
{
  "location": "string",
  "bio": "string",
  "skills": ["string", "string", "..."],
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "startYear": "string",
      "endYear": "string or Present"
    }
  ],
  "experience": [
    {
      "role": "string",
      "company": "string",
      "startYear": "string",
      "endYear": "string or Present",
      "expDescription": "string" 
    }
  ]
}
`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const { resumeText } = req.body;

  if (!resumeText) {
    return res.status(400).json({ error: "No resume text provided for parsing." });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: `
            You are an expert resume parser and data extraction API. Your ONLY task is to analyze the provided unstructured resume text and convert it into a valid JSON object based on the exact schema provided.

            CRITICAL CONSTRAINT: Your entire response MUST be a single, valid JSON object. DO NOT include any conversational text, explanations, or markdown fences (e.g., \`\`\`json or \`\`\`).
        ` },
        { role: "user", content: `
            Parse the following resume text and output the results using the JSON structure provided below. Ensure all array fields (skills, education, experience) are populated.

            --- REQUIRED JSON SCHEMA ---
            ${JSON_SCHEMA}

            --- RESUME TEXT TO PARSE ---
            ${resumeText}
        ` }
      ],
      temperature: 0.0,
    });

    const llmOutput = response.choices[0].message.content.trim();
    
    let parsedData;
    try {
      parsedData = JSON.parse(llmOutput);
    } catch (e) {
      console.error("Failed to parse LLM output as JSON:", llmOutput);
      return res.status(500).json({ 
        error: "AI parsing failed: Received non-JSON output.",
        rawOutput: llmOutput
      });
    }

    return res.status(200).json({ 
      success: true,
      parsedData: parsedData 
    });

  } catch (error) {
    console.error("OpenAI API Error during parsing:", error);
    return res.status(500).json({ 
      error: "An error occurred while communicating with the AI service.", 
      details: error.message 
    });
  }
}
