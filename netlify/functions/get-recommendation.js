// netlify/functions/get-recommendation.js
// Enhanced error handling for Supabase database issues

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// === GET ENVIRONMENT VARIABLES ===
const SUPABASE_URL = process.env.SUPABASE_URL;
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

// === NEW: Enhanced Error Detection and Classification ===
function classifySupabaseError(error) {
    const errorMessage = error.message || '';
    const errorCode = error.code || '';
    
    console.log("Function log: Classifying error:", errorMessage);
    
    // Database connection/availability issues
    if (errorMessage.includes('fetch failed') || 
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('network error') ||
        errorMessage.includes('connection refused')) {
        return {
            type: 'DATABASE_UNAVAILABLE',
            userMessage: 'Database service is currently unavailable. Please try again later or contact support.',
            technicalDetails: errorMessage
        };
    }
    
    // RPC function not found/disabled
    if (errorMessage.includes('function match_island_chunks') ||
        errorMessage.includes('does not exist') ||
        (errorCode && errorCode.includes('42883'))) {
        return {
            type: 'RPC_FUNCTION_MISSING',
            userMessage: 'Search function is not properly configured. Please contact support.',
            technicalDetails: errorMessage
        };
    }
    
    // Authentication/permission issues
    if (errorMessage.includes('permission denied') ||
        errorMessage.includes('insufficient privileges') ||
        errorMessage.includes('JWT') ||
        errorCode === 'PGRST301') {
        return {
            type: 'PERMISSION_DENIED',
            userMessage: 'Database access is restricted. Please contact support.',
            technicalDetails: errorMessage
        };
    }
    
    // Timeout issues
    if (errorMessage.includes('timeout') ||
        errorMessage.includes('ETIMEDOUT')) {
        return {
            type: 'TIMEOUT',
            userMessage: 'Request timed out. Please try again.',
            technicalDetails: errorMessage
        };
    }
    
    // Generic Supabase error
    if (errorMessage.includes('Supabase')) {
        return {
            type: 'SUPABASE_GENERIC',
            userMessage: 'Database service encountered an error. Please try again later.',
            technicalDetails: errorMessage
        };
    }
    
    // Unknown error
    return {
        type: 'UNKNOWN',
        userMessage: 'An unexpected error occurred. Please try again later.',
        technicalDetails: errorMessage
    };
}

// === Enhanced Error Response Helper ===
function createErrorResponse(statusCode, errorClassification, originalError = null) {
    const response = {
        error: errorClassification.userMessage,
        errorType: errorClassification.type,
        technicalDetails: errorClassification.technicalDetails
    };
    
    // Add debugging info in development/testing
    if (process.env.NODE_ENV !== 'production') {
        response.debug = {
            originalError: originalError?.message || 'No original error',
            timestamp: new Date().toISOString()
        };
    }
    
    console.error(`Function log: Returning ${errorClassification.type} error:`, response);
    
    return {
        statusCode,
        body: JSON.stringify(response),
        headers: { 'Content-Type': 'application/json' },
    };
}

// === Core Logic Functions (with enhanced error handling) ===

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

async function searchChunks(queryEmbedding) {
    console.log("Function log: Searching Supabase chunks...");
    if (!supabase) throw new Error("Supabase client not initialized in function.");
    if (!queryEmbedding) throw new Error("Missing query embedding for search.");

    try {
        const { data: chunks, error } = await supabase.rpc('match_island_chunks', {
            p_query_embedding: queryEmbedding,
            p_match_threshold: 0.75,
            p_match_count: 3
        });

        if (error) {
            console.error("Function log: Error searching chunks RPC:", error);
            // Re-throw with enhanced error info
            const enhancedError = new Error(`Supabase RPC Error: ${error.message}${error.hint ? ` (Hint: ${error.hint})` : ''}`);
            enhancedError.code = error.code;
            enhancedError.supabaseError = error;
            throw enhancedError;
        }

        console.log(`Function log: Retrieved ${chunks?.length || 0} chunks.`);
        return chunks || [];
    } catch (rpcError) {
        console.error("Function log: Error calling Supabase RPC:", rpcError);
        throw rpcError;
    }
}

async function generateFinalResponse(relevantChunks, userPreferences) {
    console.log("Function log: Generating final recommendation...");
    if (!openai) throw new Error("OpenAI client not initialized in function.");

    if (!relevantChunks || relevantChunks.length === 0) {
        console.log("Function log: No relevant chunks provided, returning default message string.");
        return '```json\n[\n {\n  "country_name": "No specific match",\n  "desc": "Based on the information I have, I couldn\'t find a specific island that perfectly matches all your preferences right now. Perhaps try adjusting your selections?",\n  "country_continent_location": "Unknown"\n }\n]\n```';
    }

    const contextString = relevantChunks
        .map((chunk, index) => `Context Chunk ${index+1} (from ${chunk.destination}):\n${chunk.chunk_text}`)
        .join("\n\n---\n\n");

    let luxuryDesc = "comfortable";
    if (userPreferences.luxuryScale <= 3) luxuryDesc = "rustic";
    else if (userPreferences.luxuryScale >= 8) luxuryDesc = "luxurious";

    const systemPrompt = `You are 'Island Breeze', an enthusiastic and friendly tropical travel planner.
    Instructions:
    Based *only* on the provided context chunks, suggest three suitable island destinations that best match the user's implied needs from the context.
    Explain *why* each island fits using only information from the provided context snippets. Make explanations three paragraphs long and be complimentary of the islands you are describing.
    Restrictions: Don't mention the words context or reference to receiving this information.
    Output:
    Format your entire response as a single JSON array of objects. Each object MUST have the keys "country_name", "desc", and "country_continent_location". Do not include any text outside the JSON array structure.
    Before you return the content check that you are not duplicating any items in the array. If you are duplicating items then regenerate the 3rd option and return the updated output.
    Example JSON format:
    [
      {
        "country_name": "Island Name, Country",
        "desc": "Explanation based on context...",
        "country_continent_location": "Continent/Region based on context or general knowledge"
      }
    ]`;

    const userPrompt = `Context:\n${contextString}`;

    console.log("Function log: Sending request to OpenAI Chat for JSON output...");

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.5,
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
       const errorClassification = {
           type: 'SERVER_CONFIG_ERROR',
           userMessage: 'Server configuration error. Please contact support.',
           technicalDetails: 'Supabase or OpenAI client not initialized'
       };
       return createErrorResponse(500, errorClassification);
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

        // 2. Formulate Query Sentence
        let luxuryDesc = "comfortable";
        if (preferences.luxuryScale <= 3) luxuryDesc = "rustic";
        else if (preferences.luxuryScale >= 8) luxuryDesc = "luxurious";
        const interestsString = preferences.interests.join(', ');
        const querySentence = `Seeking a ${luxuryDesc} destination with a ${preferences.vibe} vibe, interested in activities like ${interestsString}.`;

        // 3. Run the RAG pipeline with enhanced error handling
        const queryEmbedding = await embedQuery(querySentence);
        const relevantChunks = await searchChunks(queryEmbedding);
        const rawRecommendationString = await generateFinalResponse(relevantChunks, preferences);

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
        
        // 5. Return Success Response
        return {
            statusCode: 200,
            body: JSON.stringify({ recommendation: parsedRecommendationArray }),
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error) {
        console.error('Function log: Error in handler:', error);
        
        // === NEW: Enhanced Error Classification ===
        const errorClassification = classifySupabaseError(error);
        return createErrorResponse(500, errorClassification, error);
    }
};