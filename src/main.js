// src/main.js
// Calls Netlify function, expects response array, displays cards

import './style.css';

// === Get References to Form Elements ===
const form = document.getElementById('planner-form');
const luxuryScaleInput = document.getElementById('luxury-scale');
const luxuryValueDisplay = document.getElementById('luxury-value');
const resultsDiv = document.getElementById('results'); // Container for cards
const loadingIndicator = document.getElementById('loading-indicator');
// recommendationText element is no longer used directly for results

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
        resultsDiv.style.display = 'block'; // Show results area for loading indicator
        // Clear previous results/errors BUT KEEP H2 and loading indicator spot
        const resultsHeading = resultsDiv.querySelector('h2');
        resultsDiv.innerHTML = ''; // Clear everything
        if (resultsHeading) {
            resultsDiv.appendChild(resultsHeading); // Add heading back
        }
        resultsDiv.appendChild(loadingIndicator); // Add loading indicator back
        loadingIndicator.style.display = 'block'; // Show "Thinking..."
        form.style.display = 'block'; // Ensure form is visible at start

        // --- Create Preferences Object to Send ---
        const preferences = {
            luxuryScale: luxuryScale,
            vibe: vibe,
            interests: interests
        };

        console.log("--- Form Submitted (Validation Passed) ---");
        // ... (keep console logs) ...

        // === Call the Serverless Function ===
        try {
            const response = await fetch('/.netlify/functions/get-recommendation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(preferences),
            });

            if (!response.ok) {
                let errorMsg = `HTTP error! Status: ${response.status} ${response.statusText}`;
                try {
                    const errorBody = await response.json();
                    errorMsg = errorBody.error || errorMsg;
                } catch (e) { /* Ignore */ }
                throw new Error(errorMsg);
            }

            const data = await response.json();

            // --- SUCCESS: Process Array and Create Cards ---

            // Ensure 'recommendation' exists and is an array
            if (!data.recommendation || !Array.isArray(data.recommendation)) {
                console.error("Invalid response format: 'recommendation' key missing or not an array.", data);
                throw new Error("Received an invalid response format from the server.");
            }

            const recommendations = data.recommendation;

            // Clear loading indicator and prepare for cards
            loadingIndicator.style.display = 'none';
            // Ensure heading is present (might have been cleared)
            if (!resultsDiv.querySelector('h2') && resultsHeading) {
                 resultsDiv.insertBefore(resultsHeading, resultsDiv.firstChild);
            }


            if (recommendations.length === 0) {
                // Handle case where array is empty
                const noResultsMsg = document.createElement('p');
                noResultsMsg.textContent = "Based on the information I have, I couldn't find specific islands matching your preferences. Perhaps try adjusting your selections?";
                noResultsMsg.style.textAlign = 'center';
                resultsDiv.appendChild(noResultsMsg);
            } else {
                // Loop through recommendations and create cards
                recommendations.forEach(island => {
                    // 1. Create card container
                    const card = document.createElement('div');
                    card.classList.add('island-card');

                    // 2. Create and populate elements
                    const nameH3 = document.createElement('h3');
                    nameH3.textContent = island.country_name || 'Unnamed Location';

                    const descP = document.createElement('p');
                    descP.classList.add('description');
                    descP.textContent = island.desc || 'No description available.';

                    const locationP = document.createElement('p');
                    locationP.classList.add('location');
                    locationP.textContent = island.country_continent_location || 'Location unknown';

                    // 3. Append elements to card
                    card.appendChild(nameH3);
                    card.appendChild(descP);
                    card.appendChild(locationP);

                    // 4. Append card to results div
                    resultsDiv.appendChild(card);
                });
            }

            // Final UI state: Hide form, ensure results are visible
            form.style.display = 'none';
            resultsDiv.style.display = 'block';

            console.log("--- Netlify Function Call Successful ---");

        } catch (error) {
            // --- ERROR: Display Error Message ---
            console.error("Error in fetch process:", error);

            // Clear results area, keep/add heading, hide loading
            const resultsHeading = resultsDiv.querySelector('h2'); // Re-select in case it was lost
            resultsDiv.innerHTML = ''; // Clear everything
            if (resultsHeading) {
                resultsDiv.appendChild(resultsHeading); // Add heading back
            }
            loadingIndicator.style.display = 'none';

            // Create and display error message element
            const errorP = document.createElement('p');
            errorP.classList.add('error-message'); // Use class for styling
            errorP.textContent = `Sorry, an error occurred: ${error.message}`;
            resultsDiv.appendChild(errorP);

            // Ensure results area is visible and form is visible for retry
            resultsDiv.style.display = 'block';
            form.style.display = 'block';

        } finally {
             // Ensure loading indicator is hidden in all cases (even if error occurred before it was explicitly hidden)
             if(loadingIndicator) loadingIndicator.style.display = 'none';
        }
        // === End Serverless Function Call ===

    }); // End of form submit handler
} // End of if(form)