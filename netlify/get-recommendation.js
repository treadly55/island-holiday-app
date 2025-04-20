// netlify/functions/get-recommendation.js

// IMPORTANT: This code runs server-side on Netlify.
// It uses standard 'process.env' for environment variables
// set in the Netlify UI, NOT 'import.meta.env'.

// Use require for Node.js environment in Netlify Functions
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai'); // Use require

// === INITIALIZE CLIENTS (using Netlify environment variables) ===
// These MUST be set in your Netlify site's Environment Variables settings
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY; // Use ANON key if RLS allows RPC, otherwise SERVICE key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Initialize Supabase Client (only if variables are available)
let supabase;
if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    console.error("Supabase URL or Key missing in function environment.");
}

// Initialize OpenAI Client (only if variable is available)
let openai;
if (OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    // Note: dangerouslyAllowBrowser is NOT needed or allowed here (server-side)
} else {
    console.error("OpenAI API Key missing in function environment.");
}

// === Core Logic Functions (Copied from main.js, adapted for server-side) ===

// Function 1: Embed Query
async function embedQuery(queryText) {
    // (Keep console logs for debugging on Netlify Functions logs)
    console.log("Function log: Embedding query:", queryText.substring(0,50) + "...");
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
        // Ensure function name matches the one created in Supabase exactly
        const { data: chunks, error } = await supabase.rpc('match_island_chunks', {
            p_query_embedding: queryEmbedding,
            p_match_threshold: 0.75,
            p_match_count: 3
        });

        if (error) {
            console.error("Function log: Error searching chunks RPC:", error);
            throw new Error(`Supabase RPC Error: ${error.message}`);
        }

        console.log(`Function log: Retrieved ${chunks?.length || 0} chunks.`);
        return chunks || [];
    } catch (rpcError) {
        console.error("Function log: Error calling Supabase RPC:", rpcError);
        throw rpcError;
    }
}

// Function 3: Generate Final Response
async function generateFinalResponse(relevantChunks, userPreferences) {
    console.log("Function log: Generating final recommendation...");
    if (!openai) throw new Error("OpenAI client not initialized in function.");

    if (!relevantChunks || relevantChunks.length === 0) {
        console.log("Function log: No relevant chunks provided.");
        return "Based on the information I have, I couldn't find a specific island that perfectly matches all your preferences right now. Perhaps try adjusting your selections?";
    }

    const contextString = relevantChunks
        .map((chunk, index) => `Context Chunk ${index+1} (from <span class="math-inline">\{chunk\.destination\}\)\:\\n</span>{chunk.chunk_text}`)
        .join("\n\n---\n\n");

    let luxuryDesc = "comfortable";
    if (userPreferences.luxuryScale <= 3) luxuryDesc = "rustic";
    else if (userPreferences.luxuryScale >= 8) luxuryDesc = "luxurious";
    const preferencesString = `User is looking for a ${luxuryDesc} destination (Scale: ${userPreferences.luxuryScale}/10) with a ${userPreferences.vibe} vibe, interested in: ${userPreferences.interests.join(', ')}.`;

    const systemPrompt = `You are 'Island Breeze', an enthusiastic and friendly tropical travel planner AI. Your goal is to recommend suitable island destinations based ONLY on the context provided from island descriptions and the user's stated preferences. Do not use any information beyond the provided context. Focus on highlighting aspects from the context that match the user's request. Suggest one or two destinations and briefly explain why they are a good fit, mentioning the destination names clearly. Keep your tone positive and inviting. If the context doesn't provide a clear match for all preferences, acknowledge that but still make the best recommendation based on the available info.`;
    const userPrompt = `User Preferences: <span class="math-inline">\{preferencesString\}\\n\\nBased ONLY on the following context snippets, suggest one or two suitable island destinations and explain why they fit\:\\n\\nContext\:\\n</span>{contextString}`;

    console.log("Function log: Sending request to OpenAI Chat...");
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo", // Or your preferred model
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
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

    // Ensure clients are initialized (check if keys were loaded)
     if (!supabase || !openai) {
         console.error("Function log: Missing Supabase or OpenAI client.");
         return {
             statusCode: 500,
             body: JSON.stringify({ error: "Server configuration error." }),
         };
     }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        // 1. Parse Preferences from Frontend Request Body
        console.log("Function log: Parsing request body.");
        const preferences = JSON.parse(event.body);
        // Add validation for preferences object here if needed

        // 2. Formulate Query Sentence (can be done server-side too)
        let luxuryDesc = "comfortable";
        if (preferences.luxuryScale <= 3) luxuryDesc = "rustic";
        else if (preferences.luxuryScale >= 8) luxuryDesc = "luxurious";
        const interestsString = preferences.interests.join(', ');
        const querySentence = `Seeking a ${luxuryDesc} destination with a ${preferences.vibe} vibe, interested in activities like ${interestsString}.`;
        console.log("Function log: Generated query sentence server-side.");

        // 3. Run the RAG pipeline
        const queryEmbedding = await embedQuery(querySentence);
        const relevantChunks = await searchChunks(queryEmbedding);
        const recommendation = await generateFinalResponse(relevantChunks, preferences);

        console.log("Function log: Recommendation generated successfully.");
        // 4. Return Success Response
        return {
            statusCode: 200,
            body: JSON.stringify({ recommendation: recommendation }),
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error) {
        console.error('Function log: Error in handler:', error);
        // Return Error Response
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Failed to get recommendation: ${error.message}` }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
}; // End of exports.handler