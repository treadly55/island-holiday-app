// src/main.js
// Calls Netlify function, displays results card by card

import './style.css';

// === Get References to Form Elements ===
const form = document.getElementById('planner-form');
const luxuryScaleInput = document.getElementById('luxury-scale');
const luxuryValueDisplay = document.getElementById('luxury-value');
// Form elements needed for reset
const defaultVibeRadio = document.getElementById('vibe-beach');
const interestCheckboxes = form.querySelectorAll('input[name="interests"]');

// === Get References to Results Elements ===
const resultsDiv = document.getElementById('results'); // Main container for results section
const cardContainer = document.getElementById('card-container'); // Container specifically for cards
const loadingIndicator = document.getElementById('loading-indicator');
const nextButton = document.getElementById('next-card-button'); // Button for Next/Start Over

// === State Variables ===
let currentRecommendations = []; // Stores the array of recommendations
let currentCardIndex = 0; // Tracks the index of the currently visible card

// === Helper Function to Reset Form ===
function resetForm() {
    console.log("Resetting form...");
    // Reset range slider
    if (luxuryScaleInput) {
        luxuryScaleInput.value = 5; // Default value
    }
    if (luxuryValueDisplay) {
        luxuryValueDisplay.textContent = '5'; // Update display
    }

    // Reset radio buttons (check the default one, e.g., 'Beach')
    if (defaultVibeRadio) {
        defaultVibeRadio.checked = true;
    } else { // Fallback if ID is wrong/changed
        const vibeRadios = form.querySelectorAll('input[name="vibe"]');
        if(vibeRadios.length > 0) vibeRadios[0].checked = true; // Check the first one
    }


    // Uncheck all checkboxes
    interestCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });

    // Clear the card container as well
    if (cardContainer) {
        cardContainer.innerHTML = '';
    }
    // Ensure any previous error messages are cleared (optional, if errors are outside cardContainer)
    const errorMsgElement = resultsDiv.querySelector('.error-message');
     if (errorMsgElement) {
         errorMsgElement.remove();
     }
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

        // --- Read Form Values ---
        const formData = new FormData(form);
        const luxuryScale = parseInt(formData.get('luxuryScale'), 10);
        const vibe = formData.get('vibe');
        const interests = formData.getAll('interests');

        // --- VALIDATION ---
        if (interests.length === 0) { alert('Please select at least one activity interest.'); return; }
        if (!vibe) { alert('Please select a preferred island vibe.'); return; }
        // --- End Validation ---

        // --- UI Update: Start Loading ---
        resultsDiv.style.display = 'block'; // Show results area
        cardContainer.innerHTML = ''; // Clear previous cards
        nextButton.style.display = 'none'; // Hide button initially
        // Ensure potential previous error message is cleared
        const errorMsgElement = resultsDiv.querySelector('.error-message');
         if (errorMsgElement) {
             errorMsgElement.remove();
         }
        loadingIndicator.style.display = 'block'; // Show "Thinking..."
        form.style.display = 'block'; // Ensure form is visible if user retries after error

        // --- Create Preferences Object to Send ---
        const preferences = { /* ... (same as before) ... */
            luxuryScale: luxuryScale, vibe: vibe, interests: interests
        };

        console.log("--- Form Submitted (Validation Passed) ---");
        // ... (console logs) ...

        // === Call the Serverless Function ===
        try {
            const response = await fetch('/.netlify/functions/get-recommendation', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preferences),
            });

            if (!response.ok) { /* ... (error handling same as before) ... */
                let errorMsg = `HTTP error! Status: ${response.status} ${response.statusText}`;
                try { const errorBody = await response.json(); errorMsg = errorBody.error || errorMsg; } catch (e) { /* Ignore */ }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            loadingIndicator.style.display = 'none'; // Hide loading indicator

            // --- SUCCESS: Process Array and Create/Display Cards ---
            if (!data.recommendation || !Array.isArray(data.recommendation)) {
                throw new Error("Received an invalid response format from the server.");
            }

            // Store recommendations and reset index
            currentRecommendations = data.recommendation;
            currentCardIndex = 0;

            // Clear card container again just in case
            cardContainer.innerHTML = '';

            if (currentRecommendations.length === 0) {
                // Handle case where array is empty
                const noResultsMsg = document.createElement('p');
                noResultsMsg.textContent = "Couldn't find specific islands matching. Try adjusting selections?";
                noResultsMsg.style.textAlign = 'center';
                cardContainer.appendChild(noResultsMsg); // Add message to card area
                nextButton.style.display = 'none'; // No cards, no button
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
                    cardContainer.appendChild(card); // Append card to container
                });

                // Show the first card
                const cards = cardContainer.querySelectorAll('.island-card');
                if (cards.length > 0) {
                    cards[0].classList.add('visible'); // Use CSS class to show
                }

                // Setup and show the button
                if (currentRecommendations.length <= 1) {
                    nextButton.textContent = 'Start Over';
                } else {
                    nextButton.textContent = 'Next';
                }
                nextButton.style.display = 'block';
            }

            // Final UI state: Hide form, ensure results container is visible
            form.style.display = 'none';
            resultsDiv.style.display = 'block';

            console.log("--- Netlify Function Call Successful ---");

        } catch (error) {
            // --- ERROR: Display Error Message ---
            console.error("Error in fetch process:", error);
            loadingIndicator.style.display = 'none'; // Hide loading
            cardContainer.innerHTML = ''; // Clear any potential cards
            nextButton.style.display = 'none'; // Hide button on error

            // Remove previous error message if exists
             const existingErrorMsg = resultsDiv.querySelector('.error-message');
             if (existingErrorMsg) {
                 existingErrorMsg.remove();
             }

            // Create and display new error message element within resultsDiv
            const errorP = document.createElement('p');
            errorP.classList.add('error-message');
            errorP.textContent = `Sorry, an error occurred: ${error.message}`;
            resultsDiv.appendChild(errorP); // Append error message

            // Ensure results area is visible and form is visible for retry
            resultsDiv.style.display = 'block';
            form.style.display = 'block';

        } finally {
            // Ensure loading indicator is hidden (redundant, but safe)
            if(loadingIndicator) loadingIndicator.style.display = 'none';
        }
        // === End Serverless Function Call ===
    }); // End of form submit handler
} // End of if(form)


// === Event Listener for Next/Start Over Button ===
if (nextButton) {
    nextButton.addEventListener('click', () => {
        const cards = cardContainer.querySelectorAll('.island-card');

        // --- Handle "Start Over" ---
        if (nextButton.textContent === 'Start Over') {
            resultsDiv.style.display = 'none';   // Hide results section
            nextButton.style.display = 'none'; // Hide this button
            form.style.display = 'block';      // Show the form
            resetForm();                      // Reset form fields
            currentRecommendations = [];       // Reset state
            currentCardIndex = 0;
            return; // Stop processing
        }

        // --- Handle "Next" ---
        if (cards.length > 0 && currentCardIndex < cards.length -1) { // Check if not already on last card
            // Hide current card
            cards[currentCardIndex].classList.remove('visible');

            // Increment index
            currentCardIndex++;

            // Show next card
            cards[currentCardIndex].classList.add('visible');

            // Check if this NEW card is the last one
            if (currentCardIndex === cards.length - 1) {
                nextButton.textContent = 'Start Over'; // Change button text
            }
        }
        // If already on the last card and text is still "Next" (shouldn't happen with above logic), do nothing.
    });
} else {
    console.error("Could not find the #next-card-button element.");
}