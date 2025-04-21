// src/main.js

import './style.css';

// === Get References to Form Elements ===
const form = document.getElementById('planner-form');
const luxuryScaleInput = document.getElementById('luxury-scale');
const luxuryValueDisplay = document.getElementById('luxury-value');
const defaultVibeRadio = document.getElementById('vibe-beach');
const interestCheckboxes = form.querySelectorAll('input[name="interests"]');

// === Get References to Results Elements ===
const resultsDiv = document.getElementById('results');
const cardContainer = document.getElementById('card-container');
const loadingIndicator = document.getElementById('loading-indicator');
const nextButton = document.getElementById('next-card-button');
const backButton = document.getElementById('back-to-form-button'); // *** NEW: Back button reference ***

// === State Variables ===
let currentRecommendations = [];
let currentCardIndex = 0;

// === Helper Function to Reset Form ===
function resetForm() {
    // ... (Keep the resetForm function exactly as defined in the previous step) ...
    console.log("Resetting form...");
    if (luxuryScaleInput) luxuryScaleInput.value = 5;
    if (luxuryValueDisplay) luxuryValueDisplay.textContent = '5';
    if (defaultVibeRadio) defaultVibeRadio.checked = true;
    else { const vr = form.querySelectorAll('input[name="vibe"]'); if(vr.length > 0) vr[0].checked = true; }
    interestCheckboxes.forEach(cb => { cb.checked = false; });
    if (cardContainer) cardContainer.innerHTML = '';
    const errorMsgElement = resultsDiv.querySelector('.error-message');
    if (errorMsgElement) errorMsgElement.remove();
}

// *** NEW: Shared function to handle returning to the form view ***
function goToFormView() {
    console.log("Going back to form view...");
    resultsDiv.style.display = 'none';   // Hide results section
    if(nextButton) nextButton.style.display = 'none'; // Hide Next/Start Over button
    form.style.display = 'block';      // Show the form
    resetForm();                      // Reset form fields
    currentRecommendations = [];       // Reset state
    currentCardIndex = 0;
}

// === Update Luxury Scale Value Display ===
// ... (Keep unchanged) ...
if (luxuryScaleInput && luxuryValueDisplay) {
  luxuryScaleInput.addEventListener('input', (event) => {
    luxuryValueDisplay.textContent = event.target.value;
  });
}


// === Handle Form Submission ===
// ... (Keep the entire submit handler logic exactly as defined in the previous step) ...
// It correctly sets up the initial card display and Next/Start Over button.
if (form) {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        // ... Validation ...
         if (interests.length === 0) { alert('Please select at least one activity interest.'); return; }
         if (!vibe) { alert('Please select a preferred island vibe.'); return; }

        // --- UI Update: Start Loading ---
        resultsDiv.style.display = 'block';
        cardContainer.innerHTML = '';
        if(nextButton) nextButton.style.display = 'none';
        const errorMsgElement = resultsDiv.querySelector('.error-message');
        if (errorMsgElement) errorMsgElement.remove();
        loadingIndicator.style.display = 'block';
        form.style.display = 'block'; // Keep form visible while loading? Or hide here? Let's hide form:
        // form.style.display = 'none'; // Hide form once submission starts

        // ... Preferences object ...
        const preferences = { luxuryScale: luxuryScale, vibe: vibe, interests: interests };
        console.log("--- Form Submitted ---");

        try {
            // ... Fetch Call ...
            const response = await fetch('/.netlify/functions/get-recommendation', { /* ... */ });
            if (!response.ok) { /* ... throw error ... */ }
            const data = await response.json();
            loadingIndicator.style.display = 'none';

             // --- SUCCESS ---
            if (!data.recommendation || !Array.isArray(data.recommendation)) { /* ... throw error ... */ }

            currentRecommendations = data.recommendation;
            currentCardIndex = 0;
            cardContainer.innerHTML = '';

            if (currentRecommendations.length === 0) { /* ... handle no results ... */ }
             else {
                // Generate cards (hidden)
                currentRecommendations.forEach(island => { /* ... create/append card ... */ });

                // Show first card
                const cards = cardContainer.querySelectorAll('.island-card');
                if (cards.length > 0) cards[0].classList.add('visible');

                // Setup button
                if (nextButton) {
                    if (currentRecommendations.length <= 1) nextButton.textContent = 'Start Over';
                    else nextButton.textContent = 'Next';
                    nextButton.style.display = 'block';
                }
            }
             // Hide form, show results
             form.style.display = 'none'; // Ensure form is hidden on success
             resultsDiv.style.display = 'block';
             console.log("--- Success ---");

        } catch (error) {
            // --- ERROR ---
            console.error("Error in fetch process:", error);
            loadingIndicator.style.display = 'none';
            cardContainer.innerHTML = '';
            if(nextButton) nextButton.style.display = 'none';
            const existingErrorMsg = resultsDiv.querySelector('.error-message');
            if (existingErrorMsg) existingErrorMsg.remove();
            const errorP = document.createElement('p');
            errorP.classList.add('error-message');
            errorP.textContent = `Sorry, an error occurred: ${error.message}`;
            resultsDiv.appendChild(errorP);
            resultsDiv.style.display = 'block';
            form.style.display = 'block'; // Show form on error

        } finally {
             if(loadingIndicator) loadingIndicator.style.display = 'none';
        }
    });
}

// === Event Listener for Next/Start Over Button ===
if (nextButton) {
    nextButton.addEventListener('click', () => {
        // Check button text - Use shared function for "Start Over"
        if (nextButton.textContent === 'Start Over') {
            goToFormView(); // *** USE SHARED FUNCTION ***
            return;
        }

        // --- Handle "Next" ---
        const cards = cardContainer.querySelectorAll('.island-card');
        if (cards.length > 0 && currentCardIndex < cards.length - 1) {
            cards[currentCardIndex].classList.remove('visible');
            currentCardIndex++;
            cards[currentCardIndex].classList.add('visible');
            if (currentCardIndex === cards.length - 1) {
                nextButton.textContent = 'Start Over';
            }
        }
    });
} else { console.error("Could not find #next-card-button"); }

// *** NEW: Event Listener for the Back Button Icon ***
if (backButton) {
    backButton.addEventListener('click', () => {
        goToFormView(); // Use the same shared function
    });
} else { console.error("Could not find #back-to-form-button"); }