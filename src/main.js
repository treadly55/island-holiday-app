// src/main.js
// Handles form submission, loading overlay, card display, next/prev navigation.
// Includes dynamic title above cards.
// *** VERSION USING HARDCODED INDICES 0, 1, 2 for card navigation ***
// *** WARNING: Assumes API ALWAYS returns exactly 3 results if successful ***

import './style.css';

// === Get References to Form Elements ===
const form = document.getElementById('planner-form');
const luxuryScaleInput = document.getElementById('luxury-scale');
const luxuryValueDisplay = document.getElementById('luxury-value');
const defaultVibeRadio = document.getElementById('vibe-beach'); // For resetting
const interestCheckboxes = form.querySelectorAll('input[name="interests"]'); // For resetting

// === Get References to Results Elements ===
const resultsDiv = document.getElementById('results'); // Main results container
const cardContainer = document.getElementById('card-container'); // Container for island cards
const nextButton = document.getElementById('next-card-button'); // Next/Start Over button
const backButton = document.getElementById('back-to-form-button'); // Back icon in heading
const prevButton = document.getElementById('prev-card-button'); // Back button
const loadingOverlay = document.getElementById('loading-overlay'); // Full screen loading overlay
const recommendationTitle = document.getElementById('current-recommendation-title'); // Dynamic title H3

// === State Variables ===
let currentRecommendations = []; // Stores the fetched array
let currentCardIndex = 0; // Tracks the index (0, 1, or 2)

// === Helper Function to Reset Form ===
function resetForm() {
    // console.log("Resetting form...");
    if (form) form.reset();
    if (luxuryScaleInput) luxuryScaleInput.value = 5;
    if (luxuryValueDisplay) luxuryValueDisplay.textContent = '5';
    if (cardContainer) cardContainer.innerHTML = '';
    const errorMsgElement = resultsDiv?.querySelector('.error-message');
    if (errorMsgElement) errorMsgElement.remove();
    // Hide dynamic title on reset
    if (recommendationTitle) recommendationTitle.style.display = 'none';
}

// === Helper Function to Go To Form View ===
function goToFormView() {
    // console.log("Going back to form view...");
    if(resultsDiv) resultsDiv.style.display = 'none';
    if(nextButton) nextButton.style.display = 'none';
    if(prevButton) prevButton.style.display = 'none';
    if(form) form.style.display = 'block';
    resetForm(); // Will hide recommendationTitle
    currentRecommendations = [];
    currentCardIndex = 0;
}

// === Update Luxury Scale Value Display ===
if (luxuryScaleInput && luxuryValueDisplay) {
  luxuryScaleInput.addEventListener('input', (event) => {
    if(luxuryValueDisplay) luxuryValueDisplay.textContent = event.target.value;
  });
}

// === Handle Form Submission ===
if (form) {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        // ... Validation ...
        const formData = new FormData(form);
        const luxuryScale = parseInt(formData.get('luxuryScale'), 10);
        const vibe = formData.get('vibe');
        const interests = formData.getAll('interests');
        if (interests.length === 0) { alert('Please select at least one activity interest.'); return; }
        if (!vibe) { alert('Please select a preferred island vibe.'); return; }

        // --- UI Update: Start Loading ---
        if(cardContainer) cardContainer.innerHTML = '';
        if(nextButton) nextButton.style.display = 'none';
        if(prevButton) prevButton.style.display = 'none';
        if(recommendationTitle) recommendationTitle.style.display = 'none'; // Hide title initially
        const errorMsgElement = resultsDiv?.querySelector('.error-message');
        if (errorMsgElement) errorMsgElement.remove();
        if(form) form.style.display = 'none';
        if(loadingOverlay) loadingOverlay.classList.add('visible');

        const preferences = { luxuryScale, vibe, interests };
        console.log("--- Form Submitted ---"); // Keep basic functional log

        try {
            // --- Fetch Data ---
            const response = await fetch('/.netlify/functions/get-recommendation', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preferences),
            });

            let data;
            try { data = await response.json(); } catch (jsonError) {
                console.error("Failed to parse response as JSON:", jsonError); // Keep critical error log
                 if(loadingOverlay) loadingOverlay.classList.remove('visible');
                throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}. Response not valid JSON.`);
            }

            // --- Loading Finished: Hide Overlay ---
            if(loadingOverlay) loadingOverlay.classList.remove('visible');

            if (!response.ok) {
                const errorMsg = data?.error || `HTTP error! Status: ${response.status} ${response.statusText}`;
                throw new Error(errorMsg);
            }

            // --- SUCCESS: Process Array (ASSUMING 3 items ideally) ---
             // Note: Basic data logs removed for clarity
            if (!data.recommendation || !Array.isArray(data.recommendation)) {
                console.error("Data validation failed: 'recommendation' key missing or not an array.", data); // Keep validation error log
                throw new Error("Received an invalid response format from the server.");
            }

             if (data.recommendation.length === 0) {
                 console.warn("Received 0 recommendations."); // Keep useful warning
                 const noResultsMsg = document.createElement('p');
                 noResultsMsg.textContent = "Couldn't find specific islands matching.";
                 noResultsMsg.style.textAlign = 'center';
                 if(cardContainer) cardContainer.appendChild(noResultsMsg);
                 if(nextButton) nextButton.style.display = 'none';
                 if(prevButton) prevButton.style.display = 'none';
                 if(recommendationTitle) recommendationTitle.style.display = 'none'; // Keep title hidden
             } else {
                 // *** WARNING: Assumes 3 items are present from here for hardcoded logic later ***
                currentRecommendations = data.recommendation;
                currentCardIndex = 0;
                if(cardContainer) cardContainer.innerHTML = '';

                // Generate all card elements
                currentRecommendations.forEach((island, index) => {
                    // Removed numberSpan/title generation from inside card
                    const card = document.createElement('div');
                    card.classList.add('island-card');
                    const nameH3 = document.createElement('h3'); nameH3.textContent = island?.country_name || 'N/A'; card.appendChild(nameH3);
                    const descP = document.createElement('p'); descP.classList.add('description'); descP.textContent = island?.desc || 'N/A'; card.appendChild(descP);
                    const locationP = document.createElement('p'); locationP.classList.add('location'); locationP.textContent = island?.country_continent_location || 'N/A'; card.appendChild(locationP);
                    if(cardContainer) cardContainer.appendChild(card);
                });

                // Show the first card (index 0)
                const cards = cardContainer?.querySelectorAll('.island-card');

                if (cards && cards.length > 0) {
                    cards[0].classList.add('visible');
                    // Set and show initial title
                    if(recommendationTitle) {
                        recommendationTitle.textContent = `Recommendation ${currentCardIndex + 1}`;
                        recommendationTitle.style.display = 'block';
                    }
                } else {
                     console.error("Card elements not found after generation!"); // Keep critical error log
                     const genErrorMsg = document.createElement('p'); /* ... create/append error ... */
                     if(recommendationTitle) recommendationTitle.style.display = 'none'; // Hide title if card gen failed
                }

                // Setup and show the Next button
                if (nextButton) {
                    nextButton.textContent = 'Next'; // Start with "Next" because hardcoded logic assumes > 1 result if not 0
                    nextButton.style.display = 'block';
                    nextButton.disabled = false;
                }
                 // Ensure Prev button is hidden initially
                if(prevButton) {
                     prevButton.style.display = 'none';
                     prevButton.disabled = true;
                }
            }

            // Final UI state
            if(resultsDiv) resultsDiv.style.display = 'block';
            // console.log("--- Netlify Function Call Successful ---"); // Removed basic success log

        } catch (error) {
            // --- ERROR Handling ---
            console.error("Error caught in fetch process:", error); // Keep essential error log
            if(loadingOverlay) loadingOverlay.classList.remove('visible');
            if(cardContainer) cardContainer.innerHTML = '';
            if(nextButton) nextButton.style.display = 'none';
            if(prevButton) prevButton.style.display = 'none';
            if(recommendationTitle) recommendationTitle.style.display = 'none'; // Hide title on error

            const existingErrorMsg = resultsDiv?.querySelector('.error-message');
            if (existingErrorMsg) existingErrorMsg.remove();
            const errorP = document.createElement('p');
            errorP.classList.add('error-message');
            errorP.textContent = `Sorry, an error occurred: ${error.message}`;
            if(resultsDiv) resultsDiv.appendChild(errorP);
            if(resultsDiv) resultsDiv.style.display = 'block';
            if(form) form.style.display = 'block';
        }
    }); // End of form submit handler
} // End of if(form)


// === Event Listener for Next/Start Over Button (Using Hardcoded Index 2 as End) ===
// *** WARNING: Navigation logic assumes exactly 3 recommendation cards exist ***
if (nextButton) {
    nextButton.addEventListener('click', () => {
        if (nextButton.textContent === 'Start Over') { goToFormView(); return; }
        const cards = cardContainer?.querySelectorAll('.island-card');
        // HARDCODED LOGIC: Only advance if current index is 0 or 1
        if (cards && currentCardIndex < 2) {
            cards[currentCardIndex].classList.remove('visible');
            currentCardIndex++;
            cards[currentCardIndex].classList.add('visible'); // Assumes cards[1] and cards[2] exist
            if (prevButton) { prevButton.style.display = 'block'; prevButton.disabled = false; }
            if (currentCardIndex === 2) { nextButton.textContent = 'Start Over'; }

            // Update dynamic title
            if(recommendationTitle) {
                 recommendationTitle.textContent = `Recommendation ${currentCardIndex + 1}`;
            }
        } else { console.log("Cannot go 'Next'. Already on last card (index 2) or cards issue."); } // Keep functional log
    });
} else { console.error("Could not find #next-card-button element."); }

// === Event Listener for the Previous Button (Using Hardcoded Index 0 as Start) ===
// *** WARNING: Navigation logic assumes exactly 3 recommendation cards exist ***
if (prevButton) {
    prevButton.addEventListener('click', () => {
        const cards = cardContainer?.querySelectorAll('.island-card');
        // Check if we can go back (index is 1 or 2)
        if (cards && currentCardIndex > 0) {
            cards[currentCardIndex].classList.remove('visible'); // Assumes cards[1] or cards[2] exists
            currentCardIndex--;
            cards[currentCardIndex].classList.add('visible'); // Assumes cards[0] or cards[1] exists
            if (nextButton) { nextButton.textContent = 'Next'; }
            if (currentCardIndex === 0) {
                prevButton.style.display = 'none';
                prevButton.disabled = true;
            }

             // Update dynamic title
             if(recommendationTitle) {
                 recommendationTitle.textContent = `Recommendation ${currentCardIndex + 1}`;
             }
        } else { console.log("Cannot go back (already on first card or cards issue)."); } // Keep functional log
    });
} else { console.error("Could not find #prev-card-button element."); }


// === Event Listener for the Back Button Icon in Heading ===
if (backButton) {
    backButton.addEventListener('click', () => { goToFormView(); });
} else { console.error("Could not find #back-to-form-button element."); }

// Null checks for robustness
if (!form) console.error("Could not find #planner-form element.");
if (!resultsDiv) console.error("Could not find #results element.");
if (!cardContainer) console.error("Could not find #card-container element.");
if (!loadingOverlay) console.error("Could not find #loading-overlay element.");
if (!prevButton) console.error("Could not find #prev-card-button element.");
if (!recommendationTitle) console.error("Could not find #current-recommendation-title element."); // Added check