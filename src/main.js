// src/main.js
// Calls Netlify function, displays results card by card
// Includes console logging for the received data

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
const backButton = document.getElementById('back-to-form-button');

// === State Variables ===
let currentRecommendations = [];
let currentCardIndex = 0;

// === Helper Function to Reset Form ===
function resetForm() {
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

// === Helper Function to Go To Form View ===
function goToFormView() {
    console.log("Going back to form view...");
    resultsDiv.style.display = 'none';
    if(nextButton) nextButton.style.display = 'none';
    form.style.display = 'block';
    resetForm();
    currentRecommendations = [];
    currentCardIndex = 0;
}

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

        // ... Validation ...
        const formData = new FormData(form);
        const luxuryScale = parseInt(formData.get('luxuryScale'), 10);
        const vibe = formData.get('vibe');
        const interests = formData.getAll('interests');
        if (interests.length === 0) { alert('Please select at least one activity interest.'); return; }
        if (!vibe) { alert('Please select a preferred island vibe.'); return; }

        // --- UI Update: Start Loading ---
        resultsDiv.style.display = 'block';
        cardContainer.innerHTML = '';
        if(nextButton) nextButton.style.display = 'none';
        const errorMsgElement = resultsDiv.querySelector('.error-message');
        if (errorMsgElement) errorMsgElement.remove();
        loadingIndicator.style.display = 'block';
        form.style.display = 'none'; // Hide form once submission starts

        // ... Preferences object ...
        const preferences = { luxuryScale: luxuryScale, vibe: vibe, interests: interests };
        console.log("--- Form Submitted ---");

        try {
            const response = await fetch('/.netlify/functions/get-recommendation', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preferences),
            });

            if (!response.ok) { /* ... throw error ... */
                let errorMsg = `HTTP error! Status: ${response.status} ${response.statusText}`;
                try { const errorBody = await response.json(); errorMsg = errorBody.error || errorMsg; } catch (e) { /* Ignore */ }
                throw new Error(errorMsg);
            }

            // Parse the response
            const data = await response.json();

            // *** ADDED CONSOLE LOGS ***
            console.log("--- Raw data object received from Netlify function: ---");
            console.log(data);
            // Log the specific part expected to be an array
            if (data && data.hasOwnProperty('recommendation')) { // Check if key exists
                console.log("--- Value of 'recommendation' key: ---");
                console.log(data.recommendation);
                console.log(`Type of 'recommendation' value: ${typeof data.recommendation}`);
                console.log(`Is 'recommendation' an array? ${Array.isArray(data.recommendation)}`);
            } else {
                console.warn("--- 'recommendation' key not found in response data ---");
            }
            // *** END ADDED CONSOLE LOGS ***


            loadingIndicator.style.display = 'none';

             // --- SUCCESS: Process Array and Create Cards ---
            if (!data.recommendation || !Array.isArray(data.recommendation)) {
                console.error("Data validation failed: 'recommendation' key missing or not an array.", data); // Added log here too
                throw new Error("Received an invalid response format from the server.");
            }

            // Store recommendations and reset index
            currentRecommendations = data.recommendation;
            currentCardIndex = 0;
            cardContainer.innerHTML = ''; // Clear container

            if (currentRecommendations.length === 0) {
                // Handle empty array
                const noResultsMsg = document.createElement('p');
                noResultsMsg.textContent = "Couldn't find specific islands matching. Try adjusting selections?";
                noResultsMsg.style.textAlign = 'center';
                cardContainer.appendChild(noResultsMsg);
                if(nextButton) nextButton.style.display = 'none';
            } else {
                // Generate all card elements (hidden by default CSS)
                currentRecommendations.forEach(island => {
                    const card = document.createElement('div');
                    card.classList.add('island-card');
                    // ... create and append h3, p (desc), p (loc) to card ...
                     const nameH3 = document.createElement('h3');
                     nameH3.textContent = island.country_name || 'Unnamed Location';
                     const descP = document.createElement('p');
                     descP.classList.add('description');
                     descP.textContent = island.desc || 'No description available.';
                     const locationP = document.createElement('p');
                     locationP.classList.add('location');
                     locationP.textContent = island.country_continent_location || 'Location unknown';
                     card.appendChild(nameH3);
                     card.appendChild(descP);
                     card.appendChild(locationP);

                    cardContainer.appendChild(card);
                });

                // Show the first card
                const cards = cardContainer.querySelectorAll('.island-card');
                if (cards.length > 0) {
                    cards[0].classList.add('visible');
                }

                // Setup and show the button
                if (nextButton) {
                    if (currentRecommendations.length <= 1) {
                        nextButton.textContent = 'Start Over';
                    } else {
                        nextButton.textContent = 'Next';
                    }
                    nextButton.style.display = 'block';
                }
            }

            // Final UI state: Hide form, ensure results container is visible
            form.style.display = 'none';
            resultsDiv.style.display = 'block';
            console.log("--- Netlify Function Call Successful ---");

        } catch (error) {
            // --- ERROR: Display Error Message ---
            // ... (Error handling remains the same, maybe add log of raw 'error' object) ...
            console.error("Error caught in fetch process:", error); // Log the caught error object
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
            form.style.display = 'block';

        } finally {
             if(loadingIndicator) loadingIndicator.style.display = 'none';
        }
        // === End Serverless Function Call ===
    }); // End of form submit handler
} // End of if(form)


// === Event Listener for Next/Start Over Button ===
if (nextButton) {
    nextButton.addEventListener('click', () => {
        if (nextButton.textContent === 'Start Over') {
            goToFormView(); return;
        }
        const cards = cardContainer.querySelectorAll('.island-card');
        if (cards.length > 0 && currentCardIndex < cards.length - 1) {
            cards[currentCardIndex].classList.remove('visible');
            currentCardIndex++;
            cards[currentCardIndex].classList.add('visible');
            if (currentCardIndex === cards.length - 1) { nextButton.textContent = 'Start Over'; }
        }
    });
} else { console.error("Could not find #next-card-button"); }

// === Event Listener for the Back Button Icon ===
if (backButton) {
    backButton.addEventListener('click', () => {
        goToFormView();
    });
} else { console.error("Could not find #back-to-form-button"); }