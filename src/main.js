import './style.css';
import { islandImagePaths } from './imageData.js';

const form = document.getElementById('planner-form');
const luxuryScaleInput = document.getElementById('luxury-scale');
const luxuryValueDisplay = document.getElementById('luxury-value');
const defaultVibeRadio = document.getElementById('vibe-beach');
const interestCheckboxes = form.querySelectorAll('input[name="interests"]');

const resultsDiv = document.getElementById('results');
const cardContainer = document.getElementById('card-container');
const nextButton = document.getElementById('next-card-button');
const backButton = document.getElementById('back-to-form-button');
const prevButton = document.getElementById('prev-card-button');
const loadingOverlay = document.getElementById('loading-overlay');
const recommendationTitle = document.getElementById('current-recommendation-title');
const statusWords = document.getElementById('status-words');

let currentRecommendations = [];
let currentCardIndex = 0;
let loadingIntervalId = null;
let loadingMessageCounter = 0;
const MAX_LOADING_MESSAGE_INDEX = 2;

function getRandomImagePath(pathsArray) {
    if (!Array.isArray(pathsArray) || pathsArray.length === 0) {
      console.warn("Image paths array is empty or invalid. Returning empty path.");
      return '';
    }
    const arrayLength = pathsArray.length;
    const randomIndex = Math.floor(Math.random() * arrayLength);
    return pathsArray[randomIndex];
}

function handleApiError(error, data = null) {
    console.error("API Error:", error);
    
    let userMessage = "An unexpected error occurred. Please try again later.";
    
    if (data && data.errorType) {
        userMessage = data.error || userMessage;
        if (data.technicalDetails) {
            console.error("Technical details:", data.technicalDetails);
        }
    } else {
        const errorMessage = error.message || error.toString();
        
        if (errorMessage.includes('Supabase RPC Error') && 
            (errorMessage.includes('fetch failed') || errorMessage.includes('TypeError'))) {
            userMessage = "Database service is currently unavailable. Please try again in a few minutes or contact support.";
            
            console.error("SUPABASE DATABASE ISSUE DETECTED:");
            console.error("- Error pattern: Supabase RPC + fetch failed");
            console.error("- Likely cause: Database is disabled/unreachable");
            console.error("- Action needed: Check Supabase dashboard or restart database");
        }
        else if (errorMessage.includes('match_island_chunks')) {
            userMessage = "🔧 Search functionality is not properly configured. Please contact support.";
            console.error("SUPABASE RPC FUNCTION ISSUE: match_island_chunks missing");
        }
        else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
            userMessage = "🌐 Network connection issue. Please check your internet connection and try again.";
        }
        else if (errorMessage.includes('Supabase')) {
            userMessage = "🗄️ Database service encountered an error. Please try again later.";
        }
        else if (errorMessage.includes('OpenAI')) {
            userMessage = "🤖 AI service encountered an error. Please try again later.";
        }
    }
    
    return userMessage;
}

function checkFormCompleteness() {
    const submitButton = document.querySelector('button[type="submit"]');
    if (!submitButton) return;

    const vibeSelected = form.querySelector('input[name="vibe"]:checked');
    const interestsSelected = form.querySelectorAll('input[name="interests"]:checked');
    const isComplete = vibeSelected && interestsSelected.length > 0;
    
    if (isComplete) {
        submitButton.classList.add('ready');
    } else {
        submitButton.classList.remove('ready');
    }
}

function updateNavigationButtons() {
    if (!currentRecommendations || currentRecommendations.length === 0) {
        if (nextButton) nextButton.style.display = 'none';
        if (prevButton) prevButton.style.display = 'none';
        return;
    }

    const totalCards = currentRecommendations.length;
    const isFirst = currentCardIndex === 0;
    const isLast = currentCardIndex === totalCards - 1;

    if (prevButton) {
        if (isFirst) {
            prevButton.style.display = 'none';
            prevButton.disabled = true;
        } else {
            prevButton.style.display = 'block';
            prevButton.disabled = false;
        }
    }

    if (nextButton) {
        nextButton.style.display = 'block';
        nextButton.disabled = false;
        
        if (isLast) {
            nextButton.textContent = 'Start new search';
        } else {
            nextButton.textContent = 'Next';
        }
        
        if (totalCards === 1) {
            nextButton.textContent = 'Start new search';
        }
    }

    if (recommendationTitle) {
        recommendationTitle.textContent = `Recommendation ${currentCardIndex + 1}/${totalCards}`;
        recommendationTitle.style.display = 'block';
    }
}

function showCard(index) {
    const cards = cardContainer?.querySelectorAll('.island-card');
    if (!cards || cards.length === 0) return;

    if (index < 0 || index >= currentRecommendations.length) {
        console.warn(`Invalid card index: ${index}. Valid range: 0-${currentRecommendations.length - 1}`);
        return;
    }

    cards.forEach(card => card.classList.remove('visible'));
    
    if (cards[index]) {
        cards[index].classList.add('visible');
        currentCardIndex = index;
        updateNavigationButtons();
        scrollToPageTop();
    }
}

function resetForm() {
    if (form) form.reset();
    if (luxuryScaleInput) luxuryScaleInput.value = 5;
    if (luxuryValueDisplay) luxuryValueDisplay.textContent = '5';
    if (cardContainer) cardContainer.innerHTML = '';
    const errorMsgElement = resultsDiv?.querySelector('.error-message');
    if (errorMsgElement) errorMsgElement.remove();
    if (recommendationTitle) recommendationTitle.style.display = 'none';
    if (statusWords) statusWords.textContent = "Completing";
    
    checkFormCompleteness();
}

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

function stopLoadingInterval() {
    if (loadingIntervalId) {
        clearInterval(loadingIntervalId);
        loadingIntervalId = null;
        if (statusWords) { statusWords.textContent = "Completing"; }
    }
}

function setFooterVisibility(isVisible) {
  const footerElement = document.querySelector('footer');
  if (footerElement) {
    footerElement.style.display = isVisible ? 'block' : 'none';
  } else { console.warn("Footer element not found to set visibility."); }
}

function scrollToPageTop() {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: 'smooth'
  });
}

function goToFormView() {
    stopLoadingInterval();
    if(resultsDiv) resultsDiv.style.display = 'none';
    if(nextButton) nextButton.style.display = 'none';
    if(prevButton) prevButton.style.display = 'none';
    if(form) form.style.display = 'block';
    resetForm();
    setFooterVisibility(true);
    scrollToPageTop();
    currentRecommendations = [];
    currentCardIndex = 0;
}

if (luxuryScaleInput && luxuryValueDisplay) {
  luxuryScaleInput.addEventListener('input', (event) => {
    if(luxuryValueDisplay) luxuryValueDisplay.textContent = event.target.value;
  });
}

const vibeRadios = form.querySelectorAll('input[name="vibe"]');
vibeRadios.forEach(radio => {
    radio.addEventListener('change', checkFormCompleteness);
});

const interestCheckboxes2 = form.querySelectorAll('input[name="interests"]');
interestCheckboxes2.forEach(checkbox => {
    checkbox.addEventListener('change', checkFormCompleteness);
});

if (luxuryScaleInput) {
    luxuryScaleInput.addEventListener('input', checkFormCompleteness);
}

document.addEventListener('DOMContentLoaded', checkFormCompleteness);

if (form) {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const formData = new FormData(form);
        const luxuryScale = parseInt(formData.get('luxuryScale'), 10);
        const vibe = formData.get('vibe');
        const interests = formData.getAll('interests');
        if (interests.length === 0) { alert('Please select at least one activity interest.'); return; }
        if (!vibe) { alert('Please select a preferred island vibe.'); return; }

        if(cardContainer) cardContainer.innerHTML = '';
        if(nextButton) nextButton.style.display = 'none';
        if(prevButton) prevButton.style.display = 'none';
        if(recommendationTitle) recommendationTitle.style.display = 'none';
        const errorMsgElement = resultsDiv?.querySelector('.error-message');
        if (errorMsgElement) errorMsgElement.remove();
        if(form) form.style.display = 'none';
        setFooterVisibility(false);
        if(loadingOverlay) loadingOverlay.classList.add('visible');

        if (statusWords) {
             loadingMessageCounter = 0;
             stopLoadingInterval();
             updateLoadingMessage();
             loadingIntervalId = setInterval(updateLoadingMessage, 3500);
        }

        const preferences = { luxuryScale, vibe, interests };
        console.log("--- Form Submitted ---");

        try {
            const response = await fetch('/.netlify/functions/get-recommendation', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preferences),
            });

            let data;
            try { data = await response.json(); } catch (jsonError) {
                console.error("Failed to parse response as JSON:", jsonError);
                stopLoadingInterval();
                if(loadingOverlay) loadingOverlay.classList.remove('visible');
                setFooterVisibility(true);
                throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}. Response not valid JSON.`);
            }

            stopLoadingInterval();
            if(loadingOverlay) loadingOverlay.classList.remove('visible');
            setFooterVisibility(true);

            if (!response.ok) {
                const errorMsg = data?.error || `HTTP error! Status: ${response.status} ${response.statusText}`;
                throw new Error(errorMsg);
            }

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
                 currentRecommendations = [];
                 currentCardIndex = 0;
                 updateNavigationButtons();

             } else {
                 currentRecommendations = data.recommendation;
                 currentCardIndex = 0;
                 if(cardContainer) cardContainer.innerHTML = '';

                 currentRecommendations.forEach((island, index) => {
                     try {
                         const card = document.createElement('div');
                         card.classList.add('island-card');

                         const imagePath = getRandomImagePath(islandImagePaths);
                         const imgElement = document.createElement('img');
                         imgElement.src = imagePath;
                         imgElement.alt = `Scenic view for ${island?.country_name || 'recommendation'}`;
                         imgElement.classList.add('island-card-image');
                         card.appendChild(imgElement);

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

                         if(cardContainer) cardContainer.appendChild(card);

                     } catch (cardGenError) {
                         console.error(`Error generating card ${index}:`, cardGenError);
                     }
                 });

                 showCard(0);
             }

            if(resultsDiv) resultsDiv.style.display = 'block';

        } catch (error) {
            console.error("Error caught in fetch process:", error);
            stopLoadingInterval();
            if(loadingOverlay) loadingOverlay.classList.remove('visible');
            setFooterVisibility(true);
            if(cardContainer) cardContainer.innerHTML = '';
            if(nextButton) nextButton.style.display = 'none';
            if(prevButton) prevButton.style.display = 'none';
            if(recommendationTitle) recommendationTitle.style.display = 'none';

            const existingErrorMsg = resultsDiv?.querySelector('.error-message');
            if (existingErrorMsg) existingErrorMsg.remove();
            
            const errorMessage = handleApiError(error, data);
            const errorP = document.createElement('p');
            errorP.classList.add('error-message');
            errorP.textContent = errorMessage;
            
            if(resultsDiv) resultsDiv.appendChild(errorP);
            if(resultsDiv) resultsDiv.style.display = 'block';
            if(form) form.style.display = 'block'; 
        }
    });
}

if (nextButton) {
    nextButton.addEventListener('click', () => {
        if (nextButton.textContent === 'Start Over') { 
            goToFormView(); 
            return; 
        }
        
        if (currentRecommendations && currentCardIndex < currentRecommendations.length - 1) {
            showCard(currentCardIndex + 1);
        } else { 
            console.log("Cannot go 'Next' - already at last card."); 
        }
    });
} else { console.error("Could not find #next-card-button element."); }

if (prevButton) {
    prevButton.addEventListener('click', () => {
        if (currentRecommendations && currentCardIndex > 0) {
            showCard(currentCardIndex - 1);
        } else { 
            console.log("Cannot go back - already at first card."); 
        }
    });
} else { console.error("Could not find #prev-card-button element."); }

if (backButton) { backButton.addEventListener('click', () => { goToFormView(); }); }
else { console.error("Could not find #back-to-form-button element."); }

if (!form) console.error("Could not find #planner-form element.");
if (!recommendationTitle) console.error("Could not find #current-recommendation-title element.");
if (!statusWords) console.error("Could not find #status-words element.");