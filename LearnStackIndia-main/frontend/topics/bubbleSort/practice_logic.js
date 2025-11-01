const PRACTICE_API_BASE_URL = '/api';

// --- PAGESHOW LISTENER (GLOBAL SCOPE) ---
window.addEventListener('pageshow', function(event) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.log('pageshow: No token, redirecting to login.');
        redirectToLogin();
    }
});

// --- Authentication and Access Check ---
(async function() {
    const token = localStorage.getItem('authToken');
    const topicId = 'sorting'; // The topic ID for Bubble Sort
    const algorithmId = 'bubbleSort'; // The algorithm ID

    // 1. Check if user is logged in
    if (!token) {
        return; // Stop execution
    } else {
        console.log('Token found, proceeding to access check.');
    }

    // 2. Check if user has access to this specific algorithm
    try {
        // Use the global PRACTICE_API_BASE_URL defined later in the file
        const accessResponse = await fetch(`${PRACTICE_API_BASE_URL}/auth/check-access/${topicId}/${algorithmId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!accessResponse.ok) {
            // Handle HTTP errors
            let errorMsg = `HTTP error ${accessResponse.status}`;
             try {
                 const errorData = await accessResponse.json();
                 errorMsg = errorData.message || errorMsg;
             } catch (e) { /* Ignore */ }

            if (accessResponse.status === 401 || accessResponse.status === 403) {
                 console.error('Authorization error checking access:', errorMsg);
                 alert('Authentication error. Please log in again.');
                 redirectToLogin();
                 return;
            } else {
                console.error('Error checking access:', errorMsg);
                alert(`Error checking access: ${errorMsg}. Redirecting to dashboard.`);
                redirectToDashboard();
                return;
            }
        }

        const accessData = await accessResponse.json();

        if (accessData.success && accessData.hasAccess) {
            console.log('Access granted to bubbleSort practice.');
            // Access granted, initialize the quiz
            initializePracticeQuiz();
        } else {
            console.warn('Access denied:', accessData.status || 'Algorithm locked');
            alert('Access Denied: This topic or algorithm is currently locked.');
            redirectToDashboard(); // Redirect if access is denied
        }

    } catch (error) {
        console.error('Network or other error during access check:', error);
        alert(`Failed to check access: ${error.message}. Please try again later.`);
        redirectToDashboard(); // Redirect on critical error
    }
})();
function redirectToLogin() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = '../../auth.html'; // Adjust path if needed
}

function redirectToDashboard() {
    window.location.href = '../../dashboard.html'; // Adjust path if needed
}

// Bubble Sort Step-by-Step Quiz JavaScript
class BubbleSortStepQuiz {
    constructor() {
        // Array and sorting state
        this.currentArray = [];
        this.originalArray = [];
        this.currentStep = 0; // Tracks visualization/decision step number
        this.totalSteps = 0; // Total comparisons generated for the current array
        this.comparisons = [];
        this.currentComparison = 0; // Index for the comparisons array

        // Quiz state
        this.score = 0;
        this.correctDecisions = 0;
        this.wrongDecisions = 0;
        this.currentStreak = 0;
        this.bestStreak = parseInt(localStorage.getItem('bestStreak') || '0'); // Still useful for UI display
        this.arraysSorted = parseInt(localStorage.getItem('arraysSorted') || '0'); // Also for UI display if needed
        this.isActive = false; // Is a quiz currently running?

        // Current pass info for bubble sort (optional, for display logic)
        this.currentPass = 0;
        this.currentPosition = 0;
        this.totalPasses = 0;
        this.totalStepsForCurrentArray = 0; // Actual number of steps generated

        // Add timer variables
        this.practiceStartTime = null;
        this.practiceElapsedTime = 0; // in seconds
        this.practiceIntervalId = null;

        // Flag to prevent sending multiple updates for the same quiz completion
        this.progressUpdateSent = false;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupTheme();
        this.updateDisplay(); // Initialize UI display
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('theme-toggle-btn').addEventListener('click', this.toggleTheme.bind(this));

        // Quiz controls
        document.getElementById('new-quiz-btn').addEventListener('click', this.startNewArray.bind(this));
        document.getElementById('reset-btn').addEventListener('click', this.resetQuiz.bind(this));
        document.getElementById('back-to-main-btn').addEventListener('click', this.backToMain.bind(this));

        // Answer buttons
        document.getElementById('no-swap-btn').addEventListener('click', () => this.makeDecision(false));
        document.getElementById('yes-swap-btn').addEventListener('click', () => this.makeDecision(true));

        // Modal controls
        document.getElementById('sort-another-btn').addEventListener('click', this.sortAnother.bind(this));
        document.getElementById('view-results-btn').addEventListener('click', this.viewResults.bind(this));

        // Close modal on background click
        document.getElementById('completion-modal').addEventListener('click', (e) => {
            if (e.target.id === 'completion-modal') {
                this.hideModal();
            }
        });

        // Add listener for the Run Code button if it exists
        const runCodeBtn = document.getElementById('quiz-redirect-btn');
        if (runCodeBtn) {
            runCodeBtn.addEventListener('click', RunCode); // Assuming RunCode function exists globally
        }
    }

    setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light'; // Default to dark
        document.body.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const icon = document.querySelector('.theme-icon');
        if (icon) {
            icon.textContent = theme === 'dark' ? '☀️' : '🌙'; // Sun for dark, Moon for light
        }
    }

    // --- Timer Methods ---
    startPracticeTimer() {
        this.practiceStartTime = Date.now();
        if (this.practiceIntervalId) clearInterval(this.practiceIntervalId);
        this.practiceIntervalId = setInterval(() => {
            if (this.practiceStartTime) {
                this.practiceElapsedTime = Math.floor((Date.now() - this.practiceStartTime) / 1000);
            }
        }, 1000);
    }

    stopPracticeTimer() {
        if (this.practiceIntervalId) {
            clearInterval(this.practiceIntervalId);
            this.practiceIntervalId = null;
        }
        if (this.practiceStartTime) {
            this.practiceElapsedTime = Math.floor((Date.now() - this.practiceStartTime) / 1000);
            this.practiceStartTime = null; // Reset start time after stopping
        }
        return this.practiceElapsedTime; // Return final elapsed time
    }
    // --- End Timer Methods ---

    generateRandomArray(size = 6) {
        const array = [];
        const usedNumbers = new Set();
        while (array.length < size) {
            const num = Math.floor(Math.random() * 30) + 1; // Numbers between 1 and 30
            if (!usedNumbers.has(num)) {
                usedNumbers.add(num);
                array.push(num);
            }
        }
        return array;
    }

    generateComparisons(array) {
        const comparisons = [];
        const arr = [...array];
        const n = arr.length;
        this.totalPasses = n > 1 ? n - 1 : 0; // Store total passes

        for (let pass = 0; pass < n - 1; pass++) {
            let swappedInPass = false; // Optimization check
            for (let i = 0; i < n - pass - 1; i++) {
                const leftValue = arr[i];
                const rightValue = arr[i + 1];
                const shouldSwap = leftValue > rightValue; // Assuming ascending sort

                comparisons.push({
                    leftIndex: i,
                    rightIndex: i + 1,
                    leftValue: leftValue,
                    rightValue: rightValue,
                    shouldSwap: shouldSwap,
                    array: [...arr], // State *before* potential swap
                    pass: pass,
                    position: i,
                    sortedPositions: this.getSortedPositions(n, pass)
                });

                if (shouldSwap) {
                    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
                    swappedInPass = true;
                }
            }
             // Optimization: If no swaps in a pass, array is sorted
             if (!swappedInPass && pass < n - 2) { // Add check to avoid breaking unnecessarily on last pass check
                 console.log(`Optimization: Array sorted after pass ${pass + 1}.`);
                 break;
             }
        }
         this.totalStepsForCurrentArray = comparisons.length; // Store actual steps generated
         console.log(`Generated ${this.totalStepsForCurrentArray} comparison steps.`);
        return comparisons;
    }

    getSortedPositions(arrayLength, completedPasses) {
        const sorted = Array(arrayLength).fill(false);
        // Elements from n-1 down to n-1-completedPasses are sorted
        for (let k = 0; k <= completedPasses; k++) {
             if (arrayLength - 1 - k >= 0) {
                sorted[arrayLength - 1 - k] = true;
             }
        }
        return sorted;
    }

    startNewArray() {
        console.log("Starting new array quiz...");
        this.originalArray = this.generateRandomArray(6);
        this.currentArray = [...this.originalArray]; // Keep internal track of the *current* state
        this.comparisons = this.generateComparisons(this.originalArray);
        this.totalSteps = this.totalStepsForCurrentArray; // Use the actual count
        this.currentComparison = 0;
        // this.currentStep = 0; // Removed, using currentComparison instead

        // Reset quiz state for the new array
        this.score = 0;
        this.correctDecisions = 0;
        this.wrongDecisions = 0;
        this.currentStreak = 0; // Reset current streak for new array
        this.isActive = true;

        // --- Timer Reset ---
        this.stopPracticeTimer(); // Stop any previous timer
        this.practiceElapsedTime = 0; // Reset elapsed time
        this.startPracticeTimer(); // Start new timer
        this.progressUpdateSent = false; // Reset progress sent flag
        // --- End Timer Reset ---

        // UI Updates
        document.getElementById('question-container').style.display = 'block';
        document.getElementById('welcome-message').style.display = 'none';

        this.showCurrentComparison();
        this.updateDisplay(); // Update UI counters, progress bar etc.
    }

    showCurrentComparison() {
        if (!this.isActive) {
             console.warn('Quiz not active, skipping comparison show.');
             return;
        }
        // Check if we are past the last comparison
        if (this.currentComparison >= this.totalStepsForCurrentArray) {
            console.log('Attempted to show comparison beyond bounds, completing sort.');
            this.completeSort();
            return;
        }

        const comparison = this.comparisons[this.currentComparison];
        // Defensive check for missing comparison data
        if (!comparison) {
             console.error(`Error: Current comparison data is missing at step ${this.currentComparison}. Attempting to complete sort.`);
             this.completeSort(); // Try to gracefully end
             return;
        }

        // Update UI elements
        document.getElementById('question-text').textContent =
            `Should ${comparison.leftValue} and ${comparison.rightValue} be swapped?`;
        document.getElementById('left-value').textContent = comparison.leftValue;
        document.getElementById('right-value').textContent = comparison.rightValue;
        document.getElementById('step-counter').textContent =
            `Step ${this.currentComparison + 1} of ${this.totalStepsForCurrentArray}`;
        document.getElementById('step-description').textContent =
            `Pass ${comparison.pass + 1}, comparing positions ${comparison.leftIndex} and ${comparison.rightIndex}`;

        this.visualizeArray(comparison); // Visualize the array state *before* the potential swap

        // Ensure buttons are enabled
        document.getElementById('no-swap-btn').disabled = false;
        document.getElementById('yes-swap-btn').disabled = false;

        this.clearFeedback(); // Clear feedback from previous step
    }

    visualizeArray(comparison) {
        const container = document.getElementById('array-view');
        container.innerHTML = ''; // Clear previous view

        // Use the array state *before* the potential swap for visualization at the decision point
        const arrayToShow = comparison.array;
        const sortedPositions = comparison.sortedPositions || []; // Ensure it exists

        arrayToShow.forEach((value, index) => {
            const cell = document.createElement('div');
            cell.className = 'array-cell';
            cell.textContent = value;

            const indexLabel = document.createElement('div');
            indexLabel.className = 'array-index';
            indexLabel.textContent = index;
            cell.appendChild(indexLabel);

            // Highlight comparing elements
            if (index === comparison.leftIndex || index === comparison.rightIndex) {
                cell.classList.add('comparing');
            }

            // Mark sorted elements based on the comparison step's data
            if (sortedPositions[index]) {
                cell.classList.add('sorted');
            }

            container.appendChild(cell);
        });
    }

    async makeDecision(userWantsSwap) {
        if (!this.isActive) return; // Prevent action if quiz ended

        const comparison = this.comparisons[this.currentComparison];

        // Defensive check
        if (!comparison) {
            console.error(`Missing comparison data during decision at step ${this.currentComparison}.`);
            this.completeSort(); // Try to gracefully end
            return;
        }

        const isCorrect = userWantsSwap === comparison.shouldSwap;

        // Disable buttons immediately
        document.getElementById('no-swap-btn').disabled = true;
        document.getElementById('yes-swap-btn').disabled = true;

        // Visual feedback on buttons
        const noSwapBtn = document.getElementById('no-swap-btn');
        const yesSwapBtn = document.getElementById('yes-swap-btn');

        // Clear previous correct/wrong classes
        noSwapBtn.classList.remove('correct', 'wrong');
        yesSwapBtn.classList.remove('correct', 'wrong');

        // Apply new feedback classes
        if (comparison.shouldSwap) { // Correct answer is SWAP
            yesSwapBtn.classList.add('correct');
            if (userWantsSwap === false) noSwapBtn.classList.add('wrong'); // User chose NO SWAP (wrong)
        } else { // Correct answer is NO SWAP
            noSwapBtn.classList.add('correct');
            if (userWantsSwap === true) yesSwapBtn.classList.add('wrong'); // User chose SWAP (wrong)
        }

        // Update stats
        if (isCorrect) {
            this.score += 10;
            this.correctDecisions++;
            this.currentStreak++;
            this.bestStreak = Math.max(this.bestStreak, this.currentStreak); // Update best streak
            this.showFeedback('Correct! ' + (comparison.shouldSwap ? 'Swap needed.' : 'No swap needed.'), 'correct');
        } else {
            this.wrongDecisions++;
            this.currentStreak = 0; // Reset current streak on wrong answer
            const explanation = comparison.shouldSwap ?
                `Wrong. ${comparison.leftValue} > ${comparison.rightValue}, so they should be swapped.` :
                `Wrong. ${comparison.leftValue} <= ${comparison.rightValue}, so no swap is needed.`;
            this.showFeedback(explanation, 'wrong');
        }

        this.updateDisplay(); // Update score/accuracy display immediately

        // --- Visual Swap Logic ---
        // Apply swap visually *after* feedback if the decision was correct AND a swap was needed
        if (comparison.shouldSwap && isCorrect) {
             await this.animateSwap(comparison.leftIndex, comparison.rightIndex);
             // Update the internal currentArray state AFTER the visual swap reflects the change
             // This ensures the next comparison uses the correctly swapped array
             [this.currentArray[comparison.leftIndex], this.currentArray[comparison.rightIndex]] =
             [this.currentArray[comparison.rightIndex], this.currentArray[comparison.leftIndex]];
        } else if (comparison.shouldSwap && !isCorrect) {
             // If wrong and swap was needed, just pause briefly to allow user to see feedback.
             // Don't visually swap or change currentArray.
              await new Promise(resolve => setTimeout(resolve, 600)); // Pause duration
        } else { // No swap was needed (correct or incorrect decision doesn't matter for visual state)
             // Pause briefly to allow user to see feedback.
              await new Promise(resolve => setTimeout(resolve, 600)); // Pause duration
        }
        // --- End Visual Swap Logic ---


        // Proceed to next step after a delay to allow reading feedback/seeing animation
        setTimeout(() => {
            if (this.isActive) { // Check if still active before proceeding
               this.nextComparison();
            }
        }, 1500); // Increased delay
    }

     async animateSwap(leftIndex, rightIndex) {
        const cells = document.querySelectorAll('#array-view .array-cell'); // Target cells within the specific container
        // Basic bounds check
        if (leftIndex < 0 || rightIndex >= cells.length || leftIndex >= rightIndex) {
            console.error(`Invalid indices for swap animation: ${leftIndex}, ${rightIndex}`);
            return;
        }
        const leftCell = cells[leftIndex];
        const rightCell = cells[rightIndex];

        if (leftCell && rightCell) {
            // Add classes to trigger CSS animation/transition
            leftCell.classList.add('swapping');
            rightCell.classList.add('swapping-back');

            // Wait for the animation to roughly complete
            await new Promise(resolve => setTimeout(resolve, 600)); // Adjust time to match CSS animation

            // --- Visually update the text content ---
             // Get the text content, excluding the index span if present
             const getNodeText = (node) => {
                 let text = '';
                 node.childNodes.forEach(child => {
                     if (child.nodeType === Node.TEXT_NODE) {
                         text += child.textContent;
                     }
                 });
                 return text.trim();
             };
             const leftValueText = getNodeText(leftCell);
             const rightValueText = getNodeText(rightCell);

             // Find the text node to update (assuming it's the first child)
             const leftTextNode = leftCell.firstChild;
             const rightTextNode = rightCell.firstChild;

             if (leftTextNode && leftTextNode.nodeType === Node.TEXT_NODE) {
                 leftTextNode.textContent = rightValueText;
             } else { // Fallback if structure is different
                 leftCell.textContent = rightValueText;
                 // Re-add index if needed
                 const indexLabel = leftCell.querySelector('.array-index');
                 if(indexLabel) leftCell.appendChild(indexLabel);
             }

              if (rightTextNode && rightTextNode.nodeType === Node.TEXT_NODE) {
                 rightTextNode.textContent = leftValueText;
             } else {
                 rightCell.textContent = leftValueText;
                  const indexLabel = rightCell.querySelector('.array-index');
                 if(indexLabel) rightCell.appendChild(indexLabel);
             }
            // --- End visual update ---


            // Remove animation classes and 'comparing' highlight
            leftCell.classList.remove('swapping', 'comparing');
            rightCell.classList.remove('swapping-back', 'comparing');

        } else {
             console.error(`Could not find cells for swap animation: indices ${leftIndex}, ${rightIndex}`);
        }
    }


    nextComparison() {
        if (!this.isActive) return; // Don't proceed if quiz ended

        // Clean up button visual state from previous step
        document.getElementById('no-swap-btn').classList.remove('correct', 'wrong');
        document.getElementById('yes-swap-btn').classList.remove('correct', 'wrong');

        this.currentComparison++; // Move to the next comparison index
        // this.currentStep = this.currentComparison; // Keep currentStep synced if needed elsewhere

        // Check if there are more comparisons left
        if (this.currentComparison < this.totalStepsForCurrentArray) {
            this.showCurrentComparison(); // Display the next comparison step
        } else {
            this.completeSort(); // All comparisons done, finish the quiz
        }

        this.clearFeedback(); // Clear feedback message for the new step
    }

     completeSort() {
         // Prevent running completion logic multiple times if called again
         if (!this.isActive) {
             console.log("completeSort called but quiz is already inactive.");
             return;
         }

         this.isActive = false; // Mark quiz as completed
         const timeTakenSeconds = this.stopPracticeTimer(); // Stop timer and get total seconds

         // Ensure totalStepsForCurrentArray is valid before calculating accuracy
         const accuracy = this.totalStepsForCurrentArray > 0
             ? Math.round((this.correctDecisions / this.totalStepsForCurrentArray) * 100)
             : 0;

         // Update locally stored best streak (useful for immediate UI feedback)
         localStorage.setItem('bestStreak', this.bestStreak.toString());
          // Update local count for UI (backend handles authoritative count)
         this.arraysSorted = parseInt(localStorage.getItem('arraysSorted') || '0') + 1;
         localStorage.setItem('arraysSorted', this.arraysSorted.toString());

         // --- Send progress update to backend ---
         if (!this.progressUpdateSent) {
              console.log(`Sending final progress: Accuracy=${accuracy}, Time=${timeTakenSeconds}s`);
              sendPracticeProgressUpdate(accuracy, timeTakenSeconds, this.correctDecisions, this.wrongDecisions, this.score);
              this.progressUpdateSent = true; // Mark as sent for this quiz instance
         }
         // --- End send progress ---


         // Update final array visualization to show the fully sorted array
         // Ensure the array is actually sorted correctly based on the original
         const finalSortedArray = [...this.originalArray].sort((a, b) => a - b);
         this.visualizeFinalArray(finalSortedArray);

         // Show completion modal with results
         this.showCompletionModal(accuracy, timeTakenSeconds);

         // Update final UI display (scores, stats, progress bar to 100%)
         this.updateDisplay();
     }


    visualizeFinalArray(sortedArray) {
        const container = document.getElementById('array-view');
        container.innerHTML = ''; // Clear previous view

        sortedArray.forEach((value, index) => {
            const cell = document.createElement('div');
            // Add 'sorted' class to all cells in the final view
            cell.className = 'array-cell sorted'; // Make sure class name includes 'sorted'
             // Ensure text content is set correctly
            cell.textContent = value;


            const indexLabel = document.createElement('div');
            indexLabel.className = 'array-index';
            indexLabel.textContent = index;
            cell.appendChild(indexLabel);

            container.appendChild(cell);
        });

        // Update step info for completion
        document.getElementById('step-counter').textContent = 'Completed!';
        document.getElementById('step-description').textContent = 'Array is now sorted in ascending order.';
    }


    showCompletionModal(accuracy, timeTaken) { // timeTaken is in seconds
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-accuracy').textContent = `${accuracy}%`;
        document.getElementById('total-steps').textContent = this.totalStepsForCurrentArray; // Use correct total
        document.getElementById('time-taken').textContent = `${timeTaken}s`; // Display time in seconds

        let message = '';
        if (accuracy >= 90) message = '🥇 Excellent! You have mastered bubble sort decisions!';
        else if (accuracy >= 75) message = '🥈 Good job! You understand the algorithm well.';
        else if (accuracy >= 60) message = '🥉 Not bad! Keep practicing to improve.';
        else message = '💪 Keep learning! Remember: swap if left > right (for ascending).';
        document.getElementById('performance-message').textContent = message;

        // Make the modal visible
        const modal = document.getElementById('completion-modal');
        if (modal) modal.classList.add('show');
    }

    hideModal() {
        const modal = document.getElementById('completion-modal');
        if (modal) modal.classList.remove('show');
    }

    sortAnother() {
        this.hideModal();
        this.startNewArray(); // Resets state and starts a new quiz instance
    }

    viewResults() {
        // This button now just closes the modal, as the final array is visible behind it.
        this.hideModal();
    }

    showFeedback(message, type) {
        const feedback = document.getElementById('feedback');
        if (!feedback) return; // Guard against missing element
        feedback.textContent = message;
        // Reset classes first, then add new ones for reliable styling
        feedback.className = 'feedback';
        feedback.classList.add(type, 'show');
    }

    clearFeedback() {
        const feedback = document.getElementById('feedback');
         if (!feedback) return;
        feedback.className = 'feedback'; // Removes 'correct', 'wrong', 'show'
        feedback.textContent = ''; // Clear the message
    }

    updateDisplay() {
        // Safely update elements, checking if they exist first
        const scoreEl = document.getElementById('current-score');
        const correctEl = document.getElementById('correct-count');
        const wrongEl = document.getElementById('wrong-count');
        const accuracyEl = document.getElementById('accuracy');
        const progressFillEl = document.getElementById('progress-fill');
        const progressTextEl = document.getElementById('progress-text');
        const correctDecisionsEl = document.getElementById('correct-decisions');
        const wrongDecisionsEl = document.getElementById('wrong-decisions');
        const currentStreakEl = document.getElementById('current-streak');
        const bestStreakEl = document.getElementById('best-streak');
        const arraysSortedEl = document.getElementById('arrays-sorted');

        if (scoreEl) scoreEl.textContent = this.score;
        if (correctEl) correctEl.textContent = this.correctDecisions;
        if (wrongEl) wrongEl.textContent = this.wrongDecisions;

        const totalDecisions = this.correctDecisions + this.wrongDecisions;
        const currentAccuracy = totalDecisions > 0 ? Math.round((this.correctDecisions / totalDecisions) * 100) : 0;
        if (accuracyEl) accuracyEl.textContent = `${currentAccuracy}%`;

        // Calculate progress based on currentComparison index
        const progressPercent = this.totalStepsForCurrentArray > 0
            ? (this.currentComparison / this.totalStepsForCurrentArray) * 100
            : (this.isActive ? 0 : 100); // Show 100% if inactive (completed)

        if (progressFillEl) progressFillEl.style.width = `${progressPercent}%`;
        if (progressTextEl) progressTextEl.textContent = `${this.currentComparison} / ${this.totalStepsForCurrentArray} comparisons`;

        if (correctDecisionsEl) correctDecisionsEl.textContent = this.correctDecisions;
        if (wrongDecisionsEl) wrongDecisionsEl.textContent = this.wrongDecisions;

        if (currentStreakEl) currentStreakEl.textContent = this.currentStreak;
        // Use locally stored values for immediate feedback
        if (bestStreakEl) bestStreakEl.textContent = localStorage.getItem('bestStreak') || '0';
        if (arraysSortedEl) arraysSortedEl.textContent = localStorage.getItem('arraysSorted') || '0';
    }


    resetQuiz() {
        console.log("Resetting quiz...");
        this.isActive = false;
        this.stopPracticeTimer(); // Stop timer if running
        this.practiceElapsedTime = 0; // Reset timer value

        // Reset all quiz-specific stats
        this.currentComparison = 0;
        // this.currentStep = 0; // Removed
        this.score = 0;
        this.correctDecisions = 0;
        this.wrongDecisions = 0;
        this.currentStreak = 0;
        this.totalStepsForCurrentArray = 0; // Reset total steps
        this.comparisons = []; // Clear comparisons
        this.currentArray = [];
        this.originalArray = [];
        this.progressUpdateSent = false; // Reset flag


        // Update UI to initial state
        document.getElementById('question-container').style.display = 'none';
        document.getElementById('welcome-message').style.display = 'block';
        document.getElementById('array-view').innerHTML = ''; // Clear visualization
        document.getElementById('step-counter').textContent = 'Ready to start';
        document.getElementById('step-description').textContent = 'Click "Start New Array" to begin sorting';


        // Ensure buttons are reset visually and functionally
         const noSwapBtn = document.getElementById('no-swap-btn');
         const yesSwapBtn = document.getElementById('yes-swap-btn');
         noSwapBtn.disabled = true; // Disable until new quiz starts
         yesSwapBtn.disabled = true;
         noSwapBtn.classList.remove('correct', 'wrong');
         yesSwapBtn.classList.remove('correct', 'wrong');


        this.updateDisplay(); // Update all counters/progress bar to 0
        this.clearFeedback();
    }

    backToMain() {
        // Optionally send progress if user leaves mid-quiz? Decide on behavior.
        // For now, just navigate back.
        console.log("Navigating back to main visualization.");
        stopPracticeTimer(); // Stop timer before leaving
        // Maybe send partial progress if needed?
        // sendPracticeProgressUpdate(...)
        window.location.href = "index.html"; // Adjust path if needed
    }
}

// --- Initialize Quiz (Wrap existing DOMContentLoaded logic) ---
function initializePracticeQuiz() {
    console.log("Initializing Bubble Sort Practice Quiz page content...");

    // Instantiate the quiz class only *after* access check passes
    const quizInstance = new BubbleSortStepQuiz();

    // Move Ripple effect setup here if it depends on elements created by the class
    document.addEventListener('click', function (e) {
        if (e.target.tagName === 'BUTTON' && !e.target.disabled) {
            const button = e.target;
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height) * 1.5;
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';

            button.appendChild(ripple);

            setTimeout(() => {
                if (ripple.parentNode) {
                    ripple.parentNode.removeChild(ripple);
                }
            }, 600);
        }
    });

    console.log("Bubble Sort Practice Quiz page fully initialized after access check.");
}




// --- Ripple Effect (Keep as is) ---
document.addEventListener('click', function (e) {
    if (e.target.tagName === 'BUTTON' && !e.target.disabled) {
        const button = e.target;
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 1.5; // Make ripple slightly larger
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';

        // Prepend to allow text to stay on top? Or append, style with z-index. Append is simpler.
        button.appendChild(ripple);

        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600); // Match CSS animation duration
    }
});


// --- RunCode Function ---
// This function is called by the "Run Code" button in the HTML
function RunCode(){
  // Redirects to the main visualization page for Bubble Sort
  console.log("Redirecting to visualization page.");
  window.location.href = "index.html"; // Adjust path if needed
}



async function sendPracticeProgressUpdate(accuracy, timeSpentSeconds, correctCount, wrongCount, finalScore) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.error('No auth token found for practice progress.');
        alert('You must be logged in to save your progress.'); // Inform user
        return; // Stop if not logged in
    }

    // --- Point Calculation Logic ---
    let points = Math.max(0, finalScore); // Base points from correct answers (score is already calculated)
    // Bonus for perfect accuracy
    if (accuracy === 100) {
        points += 25; // Increased bonus for perfection
        console.log("Points +25 (Perfect Accuracy)");
    }
    // Bonus for speed (only if accuracy is decent)
    if (timeSpentSeconds < 30 && accuracy >= 80) {
        points += 15; // Increased speed bonus
        console.log("Points +15 (Speed Bonus)");
    } else if (timeSpentSeconds < 60 && accuracy >= 70) {
        points += 5; // Smaller speed bonus
        console.log("Points +5 (Decent Speed)");
    }
    // --- End Point Calculation ---

    const progressData = {
        category: 'sorting',        // Match category in User model progress object
        algorithm: 'bubbleSort',   // Match algorithm key in User model progress.sorting.algorithms
        data: {
            completed: true,            // Mark practice as completed for this attempt
            accuracyPractice: accuracy, // Send final accuracy percentage
            timeSpentPractice: timeSpentSeconds, // Send time spent for this attempt in seconds
            attemptsPractice: 1,        // Send 1 for this attempt, backend should increment total
            pointsPractice: points,     // Send calculated points for this attempt
            lastAttemptPractice: new Date() // Timestamp of this attempt
            // Backend will handle updating bestTimePractice, total time, total points, etc.
        }
    };

    console.log('Sending practice progress update to backend:', progressData);

    try {
        const response = await fetch(`${PRACTICE_API_BASE_URL}/auth/progress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(progressData)
        });

        const result = await response.json();

        if (!response.ok) {
            // Log detailed error from backend if available
            console.error('Backend error response:', result);
            throw new Error(result.message || `HTTP error ${response.status}`);
        }

        console.log('Practice progress updated successfully on backend:', result);
        // Optionally update UI based on response (e.g., fetch new stats) if needed immediately

    } catch (error) {
        console.error('Error sending practice progress update:', error);
        // Provide more context in the alert
        alert(`Error saving progress: ${error.message}. Please check your connection or try again later.`);
    }

}

