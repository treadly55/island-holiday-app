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
// This function receives relevantChunks and generates the raw string response
async function generateFinalResponse(relevantChunks, userPreferences) {
    console.log("Function log: Generating final recommendation (Revised Prompts)...");
    if (!openai) throw new Error("OpenAI client not initialized in function.");

    if (!relevantChunks || relevantChunks.length === 0) {
        console.log("Function log: No relevant chunks provided, returning default message string.");
        // Returning a string that looks like the expected JSON structure for consistency,
        // although it indicates no specific match was found.
        return '```json\n[\n {\n  "country_name": "No specific match",\n  "desc": "Based on the information I have, I couldn\'t find a specific island that perfectly matches all your preferences right now. Perhaps try adjusting your selections?",\n  "country_continent_location": "Unknown"\n }\n]\n```';
    }

    const contextString = relevantChunks
        .map((chunk, index) => `Context Chunk ${index+1} (from ${chunk.destination}):\n${chunk.chunk_text}`)
        .join("\n\n---\n\n");

    let luxuryDesc = "comfortable";
    if (userPreferences.luxuryScale <= 3) luxuryDesc = "rustic";
    else if (userPreferences.luxuryScale >= 8) luxuryDesc = "luxurious";
    const preferencesSummaryForLog = `User looking for: ${luxuryDesc} (Scale: ${userPreferences.luxuryScale}/10), Vibe: ${userPreferences.vibe}, Interests: ${userPreferences.interests.join(', ')}.`;
    console.log("Function log: User Preferences Summary: ", preferencesSummaryForLog);


    // Revised System Prompt - Ask specifically for JSON output
    const systemPrompt = `You are 'Island Breeze', an enthusiastic and friendly tropical travel planner AI.
    Instructions:
    Based *only* on the provided context chunks, suggest one to three suitable island destinations that best match the user's implied needs from the context.
    Explain *why* each fits using only information from the provided context snippets. Make your explanations at least three paragraphs long and be overflowingly complimentary of the islands you are describing.
    Restrictions: Don't mention the words context or reference to receiving this information.
    Output:
    Format your entire response as a single JSON array of objects. Each object MUST have the keys "country_name", "desc", and "country_continent_location". Do not include any text outside the JSON array structure.
    Example JSON format:
    [
      {
        "country_name": "Island Name, Country",
        "desc": "Explanation based on context...",
        "country_continent_location": "Continent/Region based on context or general knowledge"
      }
    ]`;
    // Removed the specific country_name/desc format instruction as it's now part of the JSON structure request.

    // Revised User Prompt (Context only)
    const userPrompt = `Context:\n${contextString}`;

    console.log("Function log: Sending request to OpenAI Chat for JSON output...");

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Ensure model supports JSON mode if needed, or rely on prompt.
            // Optional: Enable JSON mode if using compatible models like gpt-4-1106-preview or gpt-3.5-turbo-1106
            // response_format: { type: "json_object" }, // Note: Might require adjustments to prompt structure if enabled
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.5, // Slightly lower temperature for more predictable JSON
        });

        // Return the raw content string, which should ideally be the JSON array string
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
        if (!preferences || !preferences.luxuryScale || !preferences.vibe || !preferences.interests) {
             throw new Error("Invalid or incomplete preferences received.");
        }


        // 2. Formulate Query Sentence (Server-side)
        let luxuryDesc = "comfortable";
        if (preferences.luxuryScale <= 3) luxuryDesc = "rustic";
        else if (preferences.luxuryScale >= 8) luxuryDesc = "luxurious";
        const interestsString = preferences.interests.join(', ');
        const querySentence = `Seeking a ${luxuryDesc} destination with a ${preferences.vibe} vibe, interested in activities like ${interestsString}.`;


        // 3. Run the RAG pipeline - ENSURE CORRECT ORDER AND VARIABLE NAMES
        const queryEmbedding = await embedQuery(querySentence);

        // *** ENSURE THIS LINE IS PRESENT AND CORRECT ***
        const relevantChunks = await searchChunks(queryEmbedding);
        // *** ADDED DIAGNOSTIC LOG ***
        console.log("Function log: searchChunks returned:", relevantChunks);

        // *** ENSURE relevantChunks IS USED CORRECTLY HERE ***
        const rawRecommendationString = await generateFinalResponse(relevantChunks, preferences);
        console.log("Function log: Received raw string from LLM.");


        // 4. Extract and Parse JSON from the raw string
        let parsedRecommendationArray;
        try {
            const match = rawRecommendationString.match(/```json\s*([\s\S]*?)\s*```/);

            if (match && match[1]) {
                const jsonString = match[1];
                parsedRecommendationArray = JSON.parse(jsonString);
                console.log("Function log: Extracted and parsed JSON from markdown block.");
            } else {
                console.log("Function log: No JSON markdown block found, attempting direct parse.");
                parsedRecommendationArray = JSON.parse(rawRecommendationString);
            }

            if (!Array.isArray(parsedRecommendationArray)) {
                 console.warn("Function log: Parsed content is not an array. Raw string:", rawRecommendationString);
                 throw new Error("Parsed content from LLM is not an array.");
            }

        } catch (parseError) {
            console.error("Function log: Error parsing LLM response string:", parseError);
            console.error("Raw string that failed parsing:", rawRecommendationString);
            throw new Error(`Failed to parse recommendation JSON from LLM output.`);
        }

        console.log("Function log: Recommendation parsed successfully.");
        // 5. Return Success Response (using the PARSED array)
        return {
            statusCode: 200,
            body: JSON.stringify({ recommendation: parsedRecommendationArray }), // Use parsed array
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error) { // Outer catch block catches errors from steps 1-4
        console.error('Function log: Error in handler:', error);
        // Return Error Response
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Failed to get recommendation: ${error.message}` }), // Include error message
            headers: { 'Content-Type': 'application/json' },
        };
    }
}; // End of exports.handler