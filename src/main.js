// src/main.js
// Handles form submission, loading overlay with cycling text (counter/switch method),
// card display, next/prev navigation, footer visibility, and scroll-to-top.
// *** FIXED: Now uses DYNAMIC navigation based on actual array length ***
// *** REMOVED: All hardcoded indices and assumptions about 3 results ***

import './style.css';
// Import islandImagePaths - assuming imageData.js uses named export
import { islandImagePaths } from './imageData.js';

// === Get References to Form Elements ===
const form = document.getElementById('planner-form');
const luxuryScaleInput = document.getElementById('luxury-scale');
const luxuryValueDisplay = document.getElementById('luxury-value'); // Note: Element may be missing in HTML
const defaultVibeRadio = document.getElementById('vibe-beach'); // For resetting
const interestCheckboxes = form.querySelectorAll('input[name="interests"]'); // For resetting

// === Get References to Results/UI Elements ===
const resultsDiv = document.getElementById('results'); // Main results container
const cardContainer = document.getElementById('card-container'); // Container for island cards
const nextButton = document.getElementById('next-card-button'); // Next/Start Over button
const backButton = document.getElementById('back-to-form-button'); // Back icon in heading
const prevButton = document.getElementById('prev-card-button'); // Back button
const loadingOverlay = document.getElementById('loading-overlay'); // Full screen loading overlay
const recommendationTitle = document.getElementById('current-recommendation-title'); // Dynamic title H3
const statusWords = document.getElementById('status-words'); // Loading text element
// Footer element reference fetched dynamically in helper

// === State Variables ===
let currentRecommendations = []; // Stores the fetched array
let currentCardIndex = 0; // Tracks the current index
let loadingIntervalId = null; // To store interval ID
let loadingMessageCounter = 0; // Counter for loading messages
const MAX_LOADING_MESSAGE_INDEX = 2; // Max index for 3 messages


// *** Function to get a random image path (already existed) ***
function getRandomImagePath(pathsArray) {
    // Basic check for valid input
    if (!Array.isArray(pathsArray) || pathsArray.length === 0) {
      console.warn("Image paths array is empty or invalid. Returning empty path.");
      return ''; // Return empty string or a default placeholder path
    }
    // Calculate length (number of items)
    const arrayLength = pathsArray.length;
    // Generate random index from 0 to length-1
    const randomIndex = Math.floor(Math.random() * arrayLength);
    // Return the path string at that index
    return pathsArray[randomIndex];
  }

// === NEW: Function to check if all form selections are complete ===
function checkFormCompleteness() {
    const submitButton = document.querySelector('button[type="submit"]');
    if (!submitButton) return;

    // Check if a vibe is selected
    const vibeSelected = form.querySelector('input[name="vibe"]:checked');
    
    // Check if at least one interest is selected
    const interestsSelected = form.querySelectorAll('input[name="interests"]:checked');
    
    // Form is complete if both vibe and at least one interest are selected
    // (luxury scale always has a value so we don't need to check it)
    const isComplete = vibeSelected && interestsSelected.length > 0;
    
    // Toggle the "ready" class based on completeness
    if (isComplete) {
        submitButton.classList.add('ready');
    } else {
        submitButton.classList.remove('ready');
    }
}

// === NEW: Dynamic Navigation Update Function ===
function updateNavigationButtons() {
    if (!currentRecommendations || currentRecommendations.length === 0) {
        // No recommendations - hide all navigation
        if (nextButton) nextButton.style.display = 'none';
        if (prevButton) prevButton.style.display = 'none';
        return;
    }

    const totalCards = currentRecommendations.length;
    const isFirst = currentCardIndex === 0;
    const isLast = currentCardIndex === totalCards - 1;

    // Update Previous Button
    if (prevButton) {
        if (isFirst) {
            prevButton.style.display = 'none';
            prevButton.disabled = true;
        } else {
            prevButton.style.display = 'block';
            prevButton.disabled = false;
        }
    }

    // Update Next Button
    if (nextButton) {
        nextButton.style.display = 'block';
        nextButton.disabled = false;
        
        if (isLast) {
            nextButton.textContent = 'Start Over';
        } else {
            nextButton.textContent = 'Next';
        }
        
        // Special case: if only 1 recommendation, show "Start Over" immediately
        if (totalCards === 1) {
            nextButton.textContent = 'Start Over';
        }
    }

    // Update title
    if (recommendationTitle) {
        recommendationTitle.textContent = `Recommendation ${currentCardIndex + 1}/${totalCards}`;
        recommendationTitle.style.display = 'block';
    }
}

// === NEW: Function to Show Specific Card ===
function showCard(index) {
    const cards = cardContainer?.querySelectorAll('.island-card');
    if (!cards || cards.length === 0) return;

    // Validate index
    if (index < 0 || index >= currentRecommendations.length) {
        console.warn(`Invalid card index: ${index}. Valid range: 0-${currentRecommendations.length - 1}`);
        return;
    }

    // Hide all cards
    cards.forEach(card => card.classList.remove('visible'));
    
    // Show the target card
    if (cards[index]) {
        cards[index].classList.add('visible');
        currentCardIndex = index;
        updateNavigationButtons();
        scrollToPageTop();
    }
}

// === Helper Function to Reset Form ===
function resetForm() {
    // console.log("Resetting form...");
    if (form) form.reset();
    if (luxuryScaleInput) luxuryScaleInput.value = 5;
    if (luxuryValueDisplay) luxuryValueDisplay.textContent = '5'; // Will do nothing if element missing
    if (cardContainer) cardContainer.innerHTML = '';
    const errorMsgElement = resultsDiv?.querySelector('.error-message');
    if (errorMsgElement) errorMsgElement.remove();
    if (recommendationTitle) recommendationTitle.style.display = 'none';
    if (statusWords) statusWords.textContent = "Completing"; // Default text
    
    // Reset button state after form reset
    checkFormCompleteness();
}

// === Helper Function to Set Loading Message Based on Counter ===
function updateLoadingMessage() {
    if (!statusWords) return;
    let currentMessage = "";
    switch (loadingMessageCounter) {
        case 0: currentMessage = "Sending data"; break;
        case 1: currentMessage = "Analysing results"; break;
        case 2: currentMessage = "Completing"; break;
        default: currentMessage = "Completing"; loadingMessageCounter = 0; break;
    }
    statusWords.textContent = currentMessage;
    loadingMessageCounter++;
    if (loadingMessageCounter > MAX_LOADING_MESSAGE_INDEX) {
        loadingMessageCounter = 0;
    }
}

// === Helper Function to Stop Loading Interval ===
function stopLoadingInterval() {
    if (loadingIntervalId) {
        clearInterval(loadingIntervalId);
        loadingIntervalId = null;
        // console.log("Loading interval stopped.");
         if (statusWords) { statusWords.textContent = "Completing"; }
    }
}

// === Helper Function to Control Footer Visibility ===
function setFooterVisibility(isVisible) {
  const footerElement = document.querySelector('footer');
  if (footerElement) {
    footerElement.style.display = isVisible ? 'block' : 'none'; // Adjust 'block' if needed
  } else { console.warn("Footer element not found to set visibility."); }
}

// === Helper Function to Scroll to Page Top ===
function scrollToPageTop() {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: 'smooth' // Use smooth scrolling
  });
  // console.log("Scrolled to page top."); // Optional log
}

// === Helper Function to Go To Form View ===
function goToFormView() {
    // console.log("Going back to form view...");
    stopLoadingInterval();
    if(resultsDiv) resultsDiv.style.display = 'none';
    if(nextButton) nextButton.style.display = 'none';
    if(prevButton) prevButton.style.display = 'none';
    if(form) form.style.display = 'block';
    resetForm();
    setFooterVisibility(true); // Show footer when form is visible
    scrollToPageTop(); // Scroll top when going to form
    currentRecommendations = [];
    currentCardIndex = 0;
}

// === Update Luxury Scale Value Display ===
if (luxuryScaleInput && luxuryValueDisplay) { // Will not add listener if luxuryValueDisplay is null
  luxuryScaleInput.addEventListener('input', (event) => {
    if(luxuryValueDisplay) luxuryValueDisplay.textContent = event.target.value;
  });
}

// === NEW: Event Listeners for Form Completeness Checking ===
// Listen for vibe radio button changes
const vibeRadios = form.querySelectorAll('input[name="vibe"]');
vibeRadios.forEach(radio => {
    radio.addEventListener('change', checkFormCompleteness);
});

// Listen for interest checkbox changes
const interestCheckboxes2 = form.querySelectorAll('input[name="interests"]');
interestCheckboxes2.forEach(checkbox => {
    checkbox.addEventListener('change', checkFormCompleteness);
});

// Also listen for luxury scale changes (though it always has a value)
if (luxuryScaleInput) {
    luxuryScaleInput.addEventListener('input', checkFormCompleteness);
}

// Check initial state when page loads
document.addEventListener('DOMContentLoaded', checkFormCompleteness);

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
        if(recommendationTitle) recommendationTitle.style.display = 'none';
        const errorMsgElement = resultsDiv?.querySelector('.error-message');
        if (errorMsgElement) errorMsgElement.remove();
        if(form) form.style.display = 'none';
        setFooterVisibility(false); // Hide footer
        if(loadingOverlay) loadingOverlay.classList.add('visible');

        // --- Start Loading Text Cycling ---
        if (statusWords) {
             loadingMessageCounter = 0;
             stopLoadingInterval(); // Clear previous just in case
             updateLoadingMessage(); // Set initial message
             loadingIntervalId = setInterval(updateLoadingMessage, 3500);
             // console.log("Loading interval started (counter method).");
        }

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
                stopLoadingInterval();
                if(loadingOverlay) loadingOverlay.classList.remove('visible');
                 setFooterVisibility(true); // Show footer on error
                throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}. Response not valid JSON.`);
            }

            // --- Loading Finished: Stop Interval, Hide Overlay, Show Footer ---
            stopLoadingInterval();
            if(loadingOverlay) loadingOverlay.classList.remove('visible');
            setFooterVisibility(true); // Show footer on success

            if (!response.ok) {
                const errorMsg = data?.error || `HTTP error! Status: ${response.status} ${response.statusText}`;
                throw new Error(errorMsg);
            }

            // --- SUCCESS: Process Array ---
            if (!data.recommendation || !Array.isArray(data.recommendation)) {
                console.error("Data validation failed", data);
                throw new Error("Received an invalid response format from the server.");
            }

             if (data.recommendation.length === 0) {
                 console.warn("Received 0 recommendations.");
                 const noResultsMsg = document.createElement('p');
                 noResultsMsg.textContent = "Couldn't find islands matching your preferences. Please try different selections.";
                 noResultsMsg.style.textAlign = 'center';
                 if(cardContainer) cardContainer.appendChild(noResultsMsg);
                 // Reset state variables
                 currentRecommendations = [];
                 currentCardIndex = 0;
                 // Hide navigation buttons
                 updateNavigationButtons();

             } else {
                 // *** FIXED: Now works with any number of results ***
                 currentRecommendations = data.recommendation;
                 currentCardIndex = 0;
                 if(cardContainer) cardContainer.innerHTML = '';

                 // Generate all card elements
                 currentRecommendations.forEach((island, index) => {
                     try {
                         const card = document.createElement('div');
                         card.classList.add('island-card');

                         // ===============================================
                         // === START: Image Integration ===
                         // ===============================================
                         // 1. Get a random image path using the existing helper function
                         const imagePath = getRandomImagePath(islandImagePaths);

                         // 2. Create the image element
                         const imgElement = document.createElement('img');
                         imgElement.src = imagePath; // Set the source
                         imgElement.alt = `Scenic view for ${island?.country_name || 'recommendation'}`; // Add descriptive alt text
                         imgElement.classList.add('island-card-image'); // Add class for styling (needs CSS)

                         // 3. Prepend the image to the card (add it before other content)
                         card.appendChild(imgElement);
                         // ===============================================
                         // === END: Image Integration ===
                         // ===============================================

                         // Append existing elements AFTER the image
                         const nameH3 = document.createElement('h3');
                         nameH3.textContent = island?.country_name || 'N/A';
                         card.appendChild(nameH3);

                         const descP = document.createElement('p');
                         descP.classList.add('description');
                         descP.textContent = island?.desc || 'N/A';
                         card.appendChild(descP);

                         const locationP = document.createElement('p');
                         locationP.classList.add('location');
                         locationP.textContent = island?.country_continent_location || 'N/A';
                         card.appendChild(locationP);

                         // Append the fully constructed card to the container
                         if(cardContainer) cardContainer.appendChild(card);

                     } catch (cardGenError) {
                         console.error(`Error generating card ${index}:`, cardGenError);
                     }
                 });

                 // Show the first card and set up navigation
                 showCard(0);
             }

            // Final UI state
            if(resultsDiv) resultsDiv.style.display = 'block';

        } catch (error) {
            // --- ERROR Handling ---
            console.error("Error caught in fetch process:", error);
            stopLoadingInterval();
            if(loadingOverlay) loadingOverlay.classList.remove('visible');
            setFooterVisibility(true); // Show footer on error
            if(cardContainer) cardContainer.innerHTML = '';
            if(nextButton) nextButton.style.display = 'none';
            if(prevButton) prevButton.style.display = 'none';
            if(recommendationTitle) recommendationTitle.style.display = 'none';

            const existingErrorMsg = resultsDiv?.querySelector('.error-message');
            if (existingErrorMsg) existingErrorMsg.remove();
            const errorP = document.createElement('p');
            errorP.classList.add('error-message');
            errorP.textContent = `Sorry, an error occurred: ${error.message}`;
            if(resultsDiv) resultsDiv.appendChild(errorP);
            if(resultsDiv) resultsDiv.style.display = 'block';
            // NOTE: The original code showed the form again on error, keeping that behaviour:
            if(form) form.style.display = 'block'; 
        }
    });
}


// === FIXED: Dynamic Next/Start Over Button Event Listener ===
if (nextButton) {
    nextButton.addEventListener('click', () => {
        if (nextButton.textContent === 'Start Over') { 
            goToFormView(); 
            return; 
        }
        
        // Dynamic navigation: check if we can go to next card
        if (currentRecommendations && currentCardIndex < currentRecommendations.length - 1) {
            showCard(currentCardIndex + 1);
        } else { 
            console.log("Cannot go 'Next' - already at last card."); 
        }
    });
} else { console.error("Could not find #next-card-button element."); }

// === FIXED: Dynamic Previous Button Event Listener ===
if (prevButton) {
    prevButton.addEventListener('click', () => {
        // Dynamic navigation: check if we can go to previous card
        if (currentRecommendations && currentCardIndex > 0) {
            showCard(currentCardIndex - 1);
        } else { 
            console.log("Cannot go back - already at first card."); 
        }
    });
} else { console.error("Could not find #prev-card-button element."); }


// === Event Listener for the Back Button Icon in Heading ===
if (backButton) { backButton.addEventListener('click', () => { goToFormView(); }); }
else { console.error("Could not find #back-to-form-button element."); }

// Null checks
if (!form) console.error("Could not find #planner-form element.");
// ... other checks ...
if (!recommendationTitle) console.error("Could not find #current-recommendation-title element.");
if (!statusWords) console.error("Could not find #status-words element.");