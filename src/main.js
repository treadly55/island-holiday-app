// src/main.js
// Handles form submission, loading overlay, card display, navigation.

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
const loadingOverlay = document.getElementById('loading-overlay'); // Full screen loading overlay

// === State Variables ===
let currentRecommendations = []; // Stores the fetched array of island objects
let currentCardIndex = 0; // Tracks the index of the currently visible card

// === Helper Function to Reset Form ===
function resetForm() {
    console.log("Resetting form...");
    if (form) form.reset(); // More concise way to reset form fields

    // Explicitly reset range slider display as form.reset() might not trigger input event
    if (luxuryScaleInput) {
        luxuryScaleInput.value = 5; // Ensure slider value is reset
    }
    if (luxuryValueDisplay) {
        luxuryValueDisplay.textContent = '5'; // Update display span
    }
    // Ensure default radio is checked (form.reset() usually handles this if 'checked' attribute is in HTML)
    if (defaultVibeRadio) {
        // defaultVibeRadio.checked = true; // form.reset() should handle this
    }

    // Clear dynamic content areas
    if (cardContainer) {
        cardContainer.innerHTML = '';
    }
    const errorMsgElement = resultsDiv.querySelector('.error-message');
    if (errorMsgElement) {
        errorMsgElement.remove();
    }
}

// === Helper Function to Go To Form View ===
function goToFormView() {
    console.log("Going back to form view...");
    if(resultsDiv) resultsDiv.style.display = 'none';   // Hide results section
    if(nextButton) nextButton.style.display = 'none'; // Hide Next/Start Over button
    if(form) form.style.display = 'block';      // Show the form
    resetForm();                      // Reset form fields
    currentRecommendations = [];       // Reset state
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

        // --- Read Form Values ---
        const formData = new FormData(form);
        const luxuryScale = parseInt(formData.get('luxuryScale'), 10);
        const vibe = formData.get('vibe');
        const interests = formData.getAll('interests');

        // --- VALIDATION ---
        if (interests.length === 0) { alert('Please select at least one activity interest.'); return; }
        if (!vibe) { alert('Please select a preferred island vibe.'); return; }

        // --- UI Update: Start Loading ---
        // Don't show results div yet, clear relevant parts
        if(cardContainer) cardContainer.innerHTML = '';
        if(nextButton) nextButton.style.display = 'none';
        const errorMsgElement = resultsDiv.querySelector('.error-message');
        if (errorMsgElement) errorMsgElement.remove();
        if(form) form.style.display = 'none'; // Hide form
        if(loadingOverlay) loadingOverlay.classList.add('visible'); // Show Loading Overlay

        // --- Create Preferences Object to Send ---
        const preferences = { luxuryScale, vibe, interests };
        console.log("--- Form Submitted ---");

        try {
            // --- Fetch Data ---
            const response = await fetch('/.netlify/functions/get-recommendation', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preferences),
            });

            let data;
            try { data = await response.json(); } catch (jsonError) {
                console.error("Failed to parse response as JSON:", jsonError);
                throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}. Response not valid JSON.`);
            }

            // --- Loading Finished: Hide Overlay ---
            if(loadingOverlay) loadingOverlay.classList.remove('visible');

            if (!response.ok) {
                const errorMsg = data?.error || `HTTP error! Status: ${response.status} ${response.statusText}`;
                throw new Error(errorMsg);
            }

            // --- Log Received Data ---
            console.log("--- Raw data object received: ---", data);
            if (data && data.hasOwnProperty('recommendation')) {
                console.log("--- Value of 'recommendation' key: ---", data.recommendation);
                console.log(`Type: ${typeof data.recommendation}, IsArray: ${Array.isArray(data.recommendation)}`);
            } else { console.warn("--- 'recommendation' key not found ---"); }


            // --- SUCCESS: Process Array and Create Cards ---
            if (!data.recommendation || !Array.isArray(data.recommendation)) {
                console.error("Data validation failed", data);
                throw new Error("Received an invalid response format from the server.");
            }

            currentRecommendations = data.recommendation;
            currentCardIndex = 0;
            if(cardContainer) cardContainer.innerHTML = ''; // Clear again just in case

            if (currentRecommendations.length === 0) {
                // Handle no results
                const noResultsMsg = document.createElement('p');
                noResultsMsg.textContent = "Couldn't find specific islands matching. Try adjusting selections?";
                noResultsMsg.style.textAlign = 'center';
                if(cardContainer) cardContainer.appendChild(noResultsMsg);
                if(nextButton) nextButton.style.display = 'none';
            } else {
                // Generate all card elements (hidden by default CSS)
                currentRecommendations.forEach(island => {
                    const card = document.createElement('div');
                    card.classList.add('island-card');
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
                    if(cardContainer) cardContainer.appendChild(card);
                });

                // Show the first card
                const cards = cardContainer?.querySelectorAll('.island-card'); // Optional chaining
                if (cards && cards.length > 0) {
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

            // Final UI state: Show results container
            if(resultsDiv) resultsDiv.style.display = 'block';
            // Form remains hidden
            console.log("--- Netlify Function Call Successful ---");

        } catch (error) {
            // --- ERROR: Hide Overlay and Display Error Message ---
            console.error("Error caught in fetch process:", error);
            if(loadingOverlay) loadingOverlay.classList.remove('visible'); // Ensure overlay hides on error
            if(cardContainer) cardContainer.innerHTML = '';
            if(nextButton) nextButton.style.display = 'none';

            const existingErrorMsg = resultsDiv?.querySelector('.error-message'); // Optional chaining
            if (existingErrorMsg) existingErrorMsg.remove();

            const errorP = document.createElement('p');
            errorP.classList.add('error-message');
            errorP.textContent = `Sorry, an error occurred: ${error.message}`;
            if(resultsDiv) resultsDiv.appendChild(errorP); // Append error message

            // Show results area (for error msg) and form (for retry)
            if(resultsDiv) resultsDiv.style.display = 'block';
            if(form) form.style.display = 'block';
        }

    }); // End of form submit handler
} // End of if(form)


// === Event Listener for Next/Start Over Button ===
if (nextButton) {
    nextButton.addEventListener('click', () => {
        if (nextButton.textContent === 'Start Over') {
            goToFormView(); return;
        }
        const cards = cardContainer?.querySelectorAll('.island-card');
        if (cards && cards.length > 0 && currentCardIndex < cards.length - 1) {
            cards[currentCardIndex].classList.remove('visible');
            currentCardIndex++;
            cards[currentCardIndex].classList.add('visible');
            if (currentCardIndex === cards.length - 1) {
                nextButton.textContent = 'Start Over';
            }
        }
    });
} else { console.error("Could not find #next-card-button element."); }

// === Event Listener for the Back Button Icon ===
if (backButton) {
    backButton.addEventListener('click', () => {
        goToFormView();
    });
} else { console.error("Could not find #back-to-form-button element."); }

// Add some null checks / optional chaining for robustness
if (!form) console.error("Could not find #planner-form element.");
if (!resultsDiv) console.error("Could not find #results element.");
if (!cardContainer) console.error("Could not find #card-container element.");
if (!loadingOverlay) console.error("Could not find #loading-overlay element.");