// src/main.js
// Updated to call the Netlify serverless function
// Includes logic to hide form and show results card on success

import './style.css';
// No longer importing Supabase or OpenAI clients here

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
        recommendationText.textContent = ''; // Clear previous results text
        resultsDiv.style.display = 'none';   // Hide results card initially (in case it was visible from error)
        form.style.display = 'block';      // Ensure form is visible at start
        loadingIndicator.style.display = 'block'; // Show "Thinking..." within the form/app structure

        // --- Create Preferences Object to Send ---
        const preferences = {
            luxuryScale: luxuryScale,
            vibe: vibe,
            interests: interests
        };

        console.log("--- Form Submitted (Validation Passed) ---");
        console.log("Sending Preferences to Serverless Function:", preferences);
        console.log("--- Calling Netlify Function ---");

        // === Call the Serverless Function ===
        try {
            const response = await fetch('/.netlify/functions/get-recommendation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(preferences), // Send preferences as JSON
            });

            // Check if the request was successful
            if (!response.ok) {
                // Try to get error message from response body
                let errorMsg = `HTTP error! Status: ${response.status} ${response.statusText}`;
                try {
                    const errorBody = await response.json();
                    errorMsg = errorBody.error || errorMsg; // Use error message from function if available
                } catch (e) {
                    // Ignore if response body wasn't JSON
                }
                throw new Error(errorMsg);
            }

            // Get the recommendation from the response body
            const data = await response.json();
            const recommendation = data.recommendation;

            // --- SUCCESS: Update UI ---
            recommendationText.textContent = recommendation; // Display Result text
            form.style.display = 'none';              // Hide the form
            resultsDiv.style.display = 'block';         // Show the results card

            console.log("--- Netlify Function Call Successful ---");
            console.log("Received Recommendation:", recommendation);


        } catch (error) {
            // --- ERROR: Update UI ---
            console.error("Error calling Netlify function:", error);
            recommendationText.textContent = `Sorry, an error occurred: ${error.message}`; // Display error text
            form.style.display = 'block';      // Ensure form is visible to allow retry
            resultsDiv.style.display = 'block';  // Show the results card (to display the error message)

        } finally {
            // --- UI Update: Stop Loading ---
            // Hide loading indicator regardless of success or error
            loadingIndicator.style.display = 'none';
        }
        // === End Serverless Function Call ===

    }); // End of form submit handler
} // End of if(form)

// === Core RAG Logic Functions & Test Execution Comments ===
// (Keep comments as they were in your working version)
// === Core RAG Logic Functions (embedQuery, searchChunks, generateFinalResponse) ===
// These are now REMOVED from main.js as they live in netlify/functions/get-recommendation.js

// === Console Test Execution ===
// The automatic runTest() function and its call should also be REMOVED from main.js