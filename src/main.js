// src/main.js
// Full code as of Step 4 completion + Console Test added

import './style.css';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// === INITIALIZE CLIENTS (using Vite env variables) ===


// Basic validation on load
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !OPENAI_API_KEY) {
    console.error("ERROR: Missing Vite environment variables. Make sure VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_OPENAI_API_KEY are set in your .env file and Vite dev server was restarted if needed.");
    // Optionally alert the user or disable the form
    alert("Configuration error: API Keys or Supabase URL missing. Please check console.");
}

// Initialize Supabase Client
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
if (!supabase) console.error("Supabase client failed to initialize.");

// Initialize OpenAI Client
const openai = OPENAI_API_KEY ? new OpenAI({
    apiKey: OPENAI_API_KEY,
    dangerouslyAllowBrowser: true // ** Required for client-side usage, acknowledge security risk **
}) : null;
if (!openai) console.error("OpenAI client failed to initialize.");


// === Get References to Form Elements ===
const form = document.getElementById('planner-form');
const luxuryScaleInput = document.getElementById('luxury-scale');
const luxuryValueDisplay = document.getElementById('luxury-value');
const resultsDiv = document.getElementById('results');
const loadingIndicator = document.getElementById('loading-indicator');
const recommendationText = document.getElementById('recommendation-text');

// === Update Luxury Scale Value Display ===
if (luxuryScaleInput && luxuryValueDisplay) {
  luxuryScaleInput.addEventListener('input', (event) => {
    luxuryValueDisplay.textContent = event.target.value;
  });
}


// === Handle Form Submission ===
if (form) {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!supabase || !openai) {
            alert("Configuration error. Cannot proceed.");
            recommendationText.textContent = "Configuration error. Please check console."; // Show error in UI too
            return;
        }

        // --- Read Form Values ---
        const formData = new FormData(form);
        const luxuryScale = parseInt(formData.get('luxuryScale'), 10);
        const vibe = formData.get('vibe');
        const interests = formData.getAll('interests');

        // --- VALIDATION ---
        if (interests.length === 0) {
            alert('Please select at least one activity interest.');
            return;
        }
        if (!vibe) {
            alert('Please select a preferred island vibe.');
            return;
        }
        // --- End Validation ---

        // --- UI Update: Start Loading ---
        recommendationText.textContent = ''; // Clear previous results
        loadingIndicator.style.display = 'block'; // Show "Thinking..."

        // --- Create Preferences & Query ---
        const preferences = { luxuryScale, vibe, interests };
        let luxuryDesc = "comfortable";
        if (luxuryScale <= 3) luxuryDesc = "rustic";
        else if (luxuryScale >= 8) luxuryDesc = "luxurious";
        const interestsString = interests.join(', ');
        const querySentence = `Seeking a ${luxuryDesc} destination with a ${vibe} vibe, interested in activities like ${interestsString}.`;

        console.log("--- Form Submitted (Validation Passed) ---");
        console.log("Preferences:", preferences);
        console.log("Query Sentence:", querySentence);
        console.log("--- Starting RAG Process ---");

        // === Integrate Core Logic Calls ===
        try {
            // 1. Embed Query
            const queryEmbedding = await embedQuery(querySentence);
            if (!queryEmbedding) throw new Error("Failed to create query embedding."); // Stop if embedding fails

            // 2. Search Chunks
            const relevantChunks = await searchChunks(queryEmbedding);
            // Note: searchChunks returns [] if no matches, null on error. generateFinalResponse handles empty array.
            if (relevantChunks === null) throw new Error("Failed to retrieve relevant chunks from database."); // Stop on DB error

            // 3. Generate Recommendation
            const recommendation = await generateFinalResponse(relevantChunks, preferences);
            if (!recommendation) throw new Error("Failed to generate recommendation."); // Stop if generation fails unexpectedly

            // 4. Display Result in UI
            recommendationText.textContent = recommendation;
            console.log("--- RAG Process Complete ---");

        } catch (error) {
            // Display error in UI
            console.error("Error during RAG process:", error); // Log full error for debugging
            recommendationText.textContent = `Sorry, an error occurred: ${error.message}`; // Show user-friendly message
        } finally {
            // --- UI Update: Stop Loading ---
            loadingIndicator.style.display = 'none'; // Hide "Thinking..."
        }
        // === End Core Logic Integration ===

    }); // End of form submit handler
} 
// End of if(form)


// === STEP 4: Core RAG Logic Functions ===

// --- Function 1: Embed User Query ---
async function embedQuery(queryText) {
    console.log("Embedding query:", queryText);
    if (!openai) {
         console.error("OpenAI client not initialized for embedding.");
         throw new Error("OpenAI client not initialized."); // Throw error to stop flow
    }
    try {
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: queryText,
        });
        const queryEmbedding = embeddingResponse.data[0].embedding;
        console.log("Query Embedding generated (first 5 dims):", queryEmbedding.slice(0, 5));
        return queryEmbedding;
    } catch (error) {
        console.error("Error getting embedding from OpenAI:", error);
        throw error; // Re-throw error to be caught by caller
    }
}

// --- Function 2: Search Relevant Chunks in Supabase ---
async function searchChunks(queryEmbedding) {
    console.log("Searching Supabase for relevant chunks...");
     if (!supabase) {
         console.error("Supabase client not initialized for searching.");
         throw new Error("Supabase client not initialized.");
    }
     if (!queryEmbedding) {
        console.error("Cannot search chunks without a query embedding.");
        throw new Error("Missing query embedding for search.");
     }

    try {
        const { data: chunks, error } = await supabase.rpc('match_island_chunks', {
            p_query_embedding: queryEmbedding,
            p_match_threshold: 0.75, // Similarity threshold
            p_match_count: 3        // Number of matches
        });

        if (error) {
            console.error("Error searching chunks in Supabase RPC:", error);
            throw new Error(`Supabase RPC Error: ${error.message}`); // Throw specific error
        }

        console.log(`Retrieved ${chunks?.length || 0} chunks from Supabase.`);
        return chunks || []; // Return empty array if null/undefined
    } catch (rpcError) {
        console.error("Error calling Supabase RPC function:", rpcError);
        throw rpcError; // Re-throw error
    }
}

// --- Function 3: Generate Final Recommendation ---
async function generateFinalResponse(relevantChunks, userPreferences) {
    console.log("Generating final recommendation with OpenAI Chat...");
    if (!openai) {
         console.error("OpenAI client not initialized for chat.");
         throw new Error("OpenAI client not initialized.");
    }
    if (!relevantChunks || relevantChunks.length === 0) {
        console.log("No relevant chunks found to generate recommendation.");
        return "Based on the information I have, I couldn't find a specific island that perfectly matches all your preferences right now. Perhaps try adjusting the vibe or activities?"; // More helpful message
    }

    // Prepare context string
    const contextString = relevantChunks
        .map((chunk, index) => `Context Chunk ${index+1} (from ${chunk.destination}):\n${chunk.chunk_text}`)
        .join("\n\n---\n\n");

    // Prepare user preferences string
    let luxuryDesc = "comfortable";
    if (userPreferences.luxuryScale <= 3) luxuryDesc = "rustic";
    else if (userPreferences.luxuryScale >= 8) luxuryDesc = "luxurious";
    const preferencesString = `User is looking for a ${luxuryDesc} destination (Scale: ${userPreferences.luxuryScale}/10) with a ${userPreferences.vibe} vibe, interested in: ${userPreferences.interests.join(', ')}.`;

    // Define the prompts
    const systemPrompt = `You are 'Island Breeze', an enthusiastic and friendly tropical travel planner AI. Your goal is to recommend suitable island destinations based ONLY on the context provided from island descriptions and the user's stated preferences. Do not use any information beyond the provided context. Focus on highlighting aspects from the context that match the user's request. Suggest one or two destinations and briefly explain why they are a good fit, mentioning the destination names clearly. Keep your tone positive and inviting. If the context doesn't provide a clear match for all preferences, acknowledge that but still make the best recommendation based on the available info.`;

    const userPrompt = `User Preferences: ${preferencesString}\n\nBased ONLY on the following context snippets, suggest one or two suitable island destinations and explain why they fit:\n\nContext:\n${contextString}`;

    console.log("--- Sending to OpenAI Chat ---");
    // console.log("Context String Length:", contextString.length); // Optional: Check context size

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Using updated model name
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
        });

        const recommendation = completion.choices[0].message.content;
        console.log("OpenAI Chat Response received.");
        return recommendation;

    } catch (error) {
        console.error("Error getting completion from OpenAI Chat:", error);
        throw error; // Re-throw error
    }
}

// === Console Test Execution ===
// Runs automatically when the script loads to test the pipeline

async function runTest() {
    console.log("--- Starting Console Test ---");
    if (!supabase || !openai) {
        console.error("Console Test Skipped: Clients not initialized (check .env and browser console).");
        return;
    }

    const testPreferences = {
        luxuryScale: 9,
        vibe: 'Beach',
        interests: ['Romance', 'Relaxing']
    };
    let testLuxuryDesc = "comfortable";
    if (testPreferences.luxuryScale <= 3) testLuxuryDesc = "rustic";
    else if (testPreferences.luxuryScale >= 8) testLuxuryDesc = "luxurious";
    const testInterestsString = testPreferences.interests.join(', ');
    const testQuerySentence = `Seeking a ${testLuxuryDesc} destination with a ${testPreferences.vibe} vibe, interested in activities like ${testInterestsString}.`;

    console.log("Test Query Sentence:", testQuerySentence);
    console.log("Test Preferences Object:", testPreferences);

    try {
        const queryEmbedding = await embedQuery(testQuerySentence);
        if (queryEmbedding) {
            const relevantChunks = await searchChunks(queryEmbedding);
            if (relevantChunks) { // Check if relevantChunks itself is not null/undefined
                 const finalRecommendation = await generateFinalResponse(relevantChunks, testPreferences);
                 console.log("\n--- CONSOLE TEST RECOMMENDATION ---");
                 console.log(finalRecommendation);
                 console.log("--- END CONSOLE TEST RECOMMENDATION ---\n");
            } else {
                 console.error("Console Test: Failed to retrieve relevant chunks (searchChunks returned null or empty).");
            }
        } else {
            console.error("Console Test: Failed to generate query embedding.");
        }
    } catch (error) {
        console.error("Console Test: An error occurred during the test run:", error.message);
    } finally {
        console.log("--- Console Test Complete ---");
    }
}

// Run the test automatically
runTest();
// --- End Console Test Execution ---