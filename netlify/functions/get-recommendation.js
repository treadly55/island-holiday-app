// netlify/functions/get-recommendation.js

// Use require for Node.js environment in Netlify Functions
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// === GET ENVIRONMENT VARIABLES ===
// These MUST be set in your Netlify site's Environment Variables settings
// Use NON-PREFIXED names here.
const SUPABASE_URL = process.env.SUPABASE_URL;
// Use ANON_KEY if RLS policies allow RPC call, otherwise use SERVICE_KEY.
// Make sure the key used here matches the one set in Netlify UI.
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// === INITIALIZE CLIENTS ===
let supabase;
if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    console.error("Supabase URL or Key missing in function environment.");
}

let openai;
if (OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
} else {
    console.error("OpenAI API Key missing in function environment.");
}

// === Core Logic Functions (Server-Side Implementation) ===

// Function 1: Embed Query
async function embedQuery(queryText) {
    console.log("Function log: Embedding query:", queryText.substring(0, 50) + "...");
    if (!openai) throw new Error("OpenAI client not initialized in function.");

    try {
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: queryText,
        });
        const queryEmbedding = embeddingResponse.data[0].embedding;
        console.log("Function log: Query Embedding generated.");
        return queryEmbedding;
    } catch (error) {
        console.error("Function log: Error getting embedding from OpenAI:", error.message);
        throw new Error(`OpenAI Embedding Error: ${error.message}`);
    }
}

// Function 2: Search Chunks
async function searchChunks(queryEmbedding) {
    console.log("Function log: Searching Supabase chunks...");
    if (!supabase) throw new Error("Supabase client not initialized in function.");
    if (!queryEmbedding) throw new Error("Missing query embedding for search.");

    try {
        const { data: chunks, error } = await supabase.rpc('match_island_chunks', {
            p_query_embedding: queryEmbedding,
            p_match_threshold: 0.75, // Similarity threshold
            p_match_count: 3        // Number of matches
        });

        if (error) {
            console.error("Function log: Error searching chunks RPC:", error);
            throw new Error(`Supabase RPC Error: ${error.message} (Hint: ${error.hint})`); // Include hint if available
        }

        console.log(`Function log: Retrieved ${chunks?.length || 0} chunks.`);
        return chunks || [];
    } catch (rpcError) {
        console.error("Function log: Error calling Supabase RPC:", rpcError);
        throw rpcError;
    }
}

// Function 3: Generate Final Response (Revised Prompts)
async function generateFinalResponse(relevantChunks, userPreferences) {
    console.log("Function log: Generating final recommendation (Revised Prompts)...");
    if (!openai) throw new Error("OpenAI client not initialized in function.");

    if (!relevantChunks || relevantChunks.length === 0) {
        console.log("Function log: No relevant chunks provided.");
        return "Based on the information I have, I couldn't find a specific island that perfectly matches all your preferences right now. Perhaps try adjusting your selections?";
    }

    const contextString = relevantChunks
        .map((chunk, index) => `Context Chunk ${index+1} (from ${chunk.destination}):\n${chunk.chunk_text}`)
        .join("\n\n---\n\n");

    // Preferences are used by the system prompt's instructions, but not explicitly inserted into user prompt anymore
    let luxuryDesc = "comfortable";
    if (userPreferences.luxuryScale <= 3) luxuryDesc = "rustic";
    else if (userPreferences.luxuryScale >= 8) luxuryDesc = "luxurious";
    // We can still formulate this for logging or potential future use if needed
    const preferencesSummaryForLog = `User looking for: ${luxuryDesc} (Scale: ${userPreferences.luxuryScale}/10), Vibe: ${userPreferences.vibe}, Interests: ${userPreferences.interests.join(', ')}.`;
    console.log("Function log: User Preferences Summary: ", preferencesSummaryForLog);


    // Revised System Prompt
    const systemPrompt = `You are 'Island Breeze', an enthusiastic and friendly tropical travel planner AI. Your goal is to recommend suitable island destinations based ONLY on the context provided from island descriptions and the user's stated preferences (which you should infer from the context and the initial query used to find this context). Do NOT repeat the user's preferences back to them unless it's essential for clarifying the recommendation. Suggest one or two destinations, mention the names clearly, and briefly explain *why* they fit using only information from the provided context. Keep your response concise and directly answer the implied request for a recommendation. Be positive and inviting.`;

    // Revised User Prompt (Context only)
    const userPrompt = `Based ONLY on the following context snippets, suggest one or two suitable island destinations and explain why they fit:\n\nContext:\n${contextString}`;

    console.log("Function log: Sending request to OpenAI Chat (Revised)...");
    // console.log("Function log: Context sent to OpenAI:", contextString); // Optional: Log full context if debugging

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo", // Using specified model
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.6, // Slightly reduced creativity
        });

        const recommendation = completion.choices[0].message.content;
        console.log("Function log: OpenAI Chat Response received.");
        return recommendation;

    } catch (error) {
        console.error("Function log: Error getting completion from OpenAI Chat:", error.message);
        throw new Error(`OpenAI Chat Error: ${error.message}`);
    }
}


// === Netlify Function Handler ===
exports.handler = async (event, context) => {
    console.log("Function log: Handler invoked.");

    // Check if clients initialized properly
     if (!supabase || !openai) {
         console.error("Function log: Server configuration error - Supabase or OpenAI client not initialized.");
         return {
             statusCode: 500,
             body: JSON.stringify({ error: "Server configuration error. Please check function logs." }),
             headers: { 'Content-Type': 'application/json' },
         };
     }

    // Only allow POST requests for this function
    if (event.httpMethod !== 'POST') {
        console.log(`Function log: Method Not Allowed - ${event.httpMethod}`);
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        // 1. Parse Preferences from Frontend Request Body
        console.log("Function log: Parsing request body.");
        if (!event.body) {
            throw new Error("Request body is missing.");
        }
        const preferences = JSON.parse(event.body);
        console.log("Function log: Received preferences:", preferences);
        // Add basic validation for received preferences if necessary
        if (!preferences || !preferences.luxuryScale || !preferences.vibe || !preferences.interests) {
             throw new Error("Invalid or incomplete preferences received.");
        }


        // 2. Formulate Query Sentence (Server-side)
        let luxuryDesc = "comfortable";
        if (preferences.luxuryScale <= 3) luxuryDesc = "rustic";
        else if (preferences.luxuryScale >= 8) luxuryDesc = "luxurious";
        const interestsString = preferences.interests.join(', ');
        const querySentence = `Seeking a ${luxuryDesc} destination with a ${preferences.vibe} vibe, interested in activities like ${interestsString}.`;
        // Not logging the full sentence here anymore, embedQuery will log start of it.

        // 3. Run the RAG pipeline
        const queryEmbedding = await embedQuery(querySentence);
        const relevantChunks = await searchChunks(queryEmbedding);
        const recommendation = await generateFinalResponse(relevantChunks, preferences);

        console.log("Function log: Recommendation generated successfully.");
        // 4. Return Success Response
        return {
            statusCode: 200,
            body: JSON.stringify({ recommendation: recommendation }), // Send recommendation back in JSON object
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error) {
        console.error('Function log: Error in handler:', error);
        // Return Error Response
        return {
            statusCode: 500,
            // Return the specific error message for better frontend debugging if needed
            body: JSON.stringify({ error: `Failed to get recommendation: ${error.message}` }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
}; // End of exports.handler