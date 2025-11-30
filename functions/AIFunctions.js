import * as functions from "firebase-functions";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: functions.config().openai.key
});

// Cloud Function to summarize blog content
export const summarizedBlog = functions.https.onCall(async (data, context) => {
    const content = data.content
    if (!content) {
        throw new functions.https.HttpsError("invalid-argument", "Content is required");
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                role: "system",
                content: "You are a helpful assistant that summarizes long career-related articles into a short paragraph without bullet points and no strict length limit.",
                },
                {
                role: "user",
                content: content,
                },
            ],
            temperature: 0.3,
        });

        const summary = response.choices[0].message.content;
        return { summary };
    } catch (error) {
        throw new functions.https.HttpsError("internal", error.message);
    }
    });