export default async function handler(req, res) {
  console.log('=== ENVIRONMENT DEBUG ===')
  console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY)
  console.log('Key preview:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'MISSING')
  console.log('All env vars:', Object.keys(process.env).filter(key => key.includes('OPENAI')))
  
  res.json({
    openaiKey: process.env.OPENAI_API_KEY ? 'SET' : 'MISSING',
    keyPreview: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'Not available',
    allEnvVars: Object.keys(process.env).filter(key => key.includes('OPENAI'))
  })
}