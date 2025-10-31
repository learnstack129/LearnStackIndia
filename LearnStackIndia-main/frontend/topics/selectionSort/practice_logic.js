// practice_logic.js (for Selection Sort)

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
    const topicId = 'sorting'; // The topic ID
    const algorithmId = 'selectionSort'; // The algorithm ID for Selection Sort

    // 1. Check if user is logged in
    if (!token) {
        return; // Stop execution
    } else {
        console.log('Token found, proceeding to access check.');
    }

    // 2. Check if user has access to this specific algorithm
    try {
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
            console.log('Access granted to selectionSort practice.');
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

// --- Selection Sort Step-by-Step Quiz Class ---
class SelectionSortStepQuiz {
    constructor() {
        // Array and sorting state
        this.currentArray = [];
        this.originalArray = [];
        this.currentStepIndex = 0; // Index for the steps array
        this.totalSteps = 0; // Total steps generated for the current array
        this.steps = []; // Array holding step-by-step instructions/states

        // Quiz state
        this.score = 0;
        this.correctDecisions = 0;
        this.wrongDecisions = 0;
        this.currentStreak = 0;
        // Using algorithm-specific keys for local storage
        this.bestStreak = parseInt(localStorage.getItem('selectionSortBestStreak') || '0');
        this.arraysSorted = parseInt(localStorage.getItem('selectionSortArraysSorted') || '0');
        this.isActive = false; // Is a quiz currently running?

        // Timer variables
        this.practiceStartTime = null;
        this.practiceElapsedTime = 0; // in seconds
        this.practiceIntervalId = null;

        // Flag to prevent sending multiple updates for the same quiz completion
        this.progressUpdateSent = false;

        // Selection sort specific state (might be derived from step data)
        // this.currentPass = 0;
        // this.currentMinIndex = 0;
        // this.comparingIndex = 0;
        // this.sortedCount = 0;

        // Call initialization method
        // this.init(); // Initialization now happens in initializePracticeQuiz
    }

    // init() moved to initializePracticeQuiz to ensure it runs *after* access check

    setupEventListeners() {
        // Theme toggle
        document.getElementById('theme-toggle-btn').addEventListener('click', this.toggleTheme.bind(this));

        // Quiz controls
        document.getElementById('new-quiz-btn').addEventListener('click', this.startNewArray.bind(this));
        document.getElementById('reset-btn').addEventListener('click', this.resetQuiz.bind(this));
        document.getElementById('back-to-main-btn').addEventListener('click', this.backToMain.bind(this));

        // Answer buttons - Ensure IDs match the HTML for Selection Sort
        document.getElementById('keep-current-btn').addEventListener('click', () => this.makeDecision('keep'));
        document.getElementById('new-minimum-btn').addEventListener('click', () => this.makeDecision('new'));
        document.getElementById('place-minimum-btn').addEventListener('click', () => this.makeDecision('place'));

        // Modal controls
        document.getElementById('sort-another-btn').addEventListener('click', this.sortAnother.bind(this));
        document.getElementById('view-results-btn').addEventListener('click', this.viewResults.bind(this));

        // Close modal on background click
        document.getElementById('completion-modal').addEventListener('click', (e) => {
            if (e.target.id === 'completion-modal') {
                this.hideModal();
            }
        });

        // Add listener for the Run Code button
        const runCodeBtn = document.getElementById('quiz-redirect-btn');
        if (runCodeBtn) {
            runCodeBtn.addEventListener('click', RunCode);
        } else {
             console.warn("Run Code button ('quiz-redirect-btn') not found.");
        }
    }

    setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark'; // Default to dark
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
        this.stopPracticeTimer(); // Ensure any existing timer is cleared
        this.practiceStartTime = Date.now();
        this.practiceElapsedTime = 0; // Reset elapsed time
        console.log("Practice timer started.");
        this.practiceIntervalId = setInterval(() => {
            if (this.practiceStartTime) {
                this.practiceElapsedTime = Math.floor((Date.now() - this.practiceStartTime) / 1000);
            } else {
                 clearInterval(this.practiceIntervalId); // Stop if start time is cleared
                 this.practiceIntervalId = null;
            }
        }, 1000);
    }

    stopPracticeTimer() {
        if (this.practiceIntervalId) {
            clearInterval(this.practiceIntervalId);
            this.practiceIntervalId = null;
            console.log("Practice timer stopped.");
        }
        if (this.practiceStartTime) {
            this.practiceElapsedTime = Math.floor((Date.now() - this.practiceStartTime) / 1000);
            this.practiceStartTime = null; // Mark timer as stopped
            console.log(`Final practice time recorded: ${this.practiceElapsedTime}s`);
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

    // Generate steps specific to Selection Sort quiz interaction
     generateSelectionSortSteps(array) {
        const steps = [];
        const arr = [...array]; // Work on a copy
        const n = arr.length;

        for (let pass = 0; pass < n - 1; pass++) {
            let minIndex = pass; // Assume current index is minimum

            // Step: Initial minimum assumption for the pass
            steps.push({
                 type: 'init_min', // Indicate start of finding min for the pass
                 pass: pass,
                 minIndex: minIndex,
                 minValue: arr[minIndex],
                 array: [...arr],
                 sortedCount: pass,
                 // No decision needed here, just state info
            });

            // Iterate through the unsorted part to find the actual minimum
            for (let i = pass + 1; i < n; i++) {
                const currentMin = arr[minIndex];
                const comparing = arr[i];
                const shouldUpdateMin = comparing < currentMin; // Ascending sort comparison

                // Step: Comparison decision point
                steps.push({
                    type: 'compare',
                    pass: pass,
                    currentMinIndex: minIndex,
                    currentMinValue: currentMin,
                    comparingIndex: i,
                    comparingValue: comparing,
                    shouldUpdateMin: shouldUpdateMin, // Correct answer
                    array: [...arr],
                    sortedCount: pass,
                    question: `Comparing ${comparing} (at index ${i}) with current minimum ${currentMin} (at index ${minIndex}). Is ${comparing} the new minimum?`
                });

                if (shouldUpdateMin) {
                    minIndex = i; // Update minimum index if a smaller element is found
                    // Step: Acknowledge minimum update (optional, could be merged with feedback)
                     steps.push({
                         type: 'update_min',
                         pass: pass,
                         newMinIndex: minIndex,
                         newMinValue: arr[minIndex],
                         array: [...arr],
                         sortedCount: pass,
                     });
                }
            }

            // After iterating, check if a swap is needed
            if (minIndex !== pass) {
                // Step: Decision point to place the found minimum
                steps.push({
                    type: 'place',
                    pass: pass,
                    swapFromIndex: minIndex, // Index of the minimum found
                    swapToIndex: pass,    // Index where minimum should go
                    minValue: arr[minIndex],
                    valueAtTarget: arr[pass],
                    array: [...arr],
                    sortedCount: pass,
                    question: `Pass ${pass + 1} complete. Found minimum ${arr[minIndex]} at index ${minIndex}. Place it at the start of the unsorted part (index ${pass})?`
                    // Correct answer is always 'place' if minIndex !== pass
                });

                // Perform the swap in the working array *after* adding the 'place' step
                [arr[pass], arr[minIndex]] = [arr[minIndex], arr[pass]];
            } else {
                 // Step: Acknowledge no swap needed (optional, could be feedback)
                 steps.push({
                     type: 'no_swap',
                     pass: pass,
                     minIndex: minIndex, // which is equal to pass
                     minValue: arr[minIndex],
                     array: [...arr],
                     sortedCount: pass,
                 });
            }
        }
         // Add a final 'completed' state step
         steps.push({
              type: 'completed',
              array: [...arr], // Final sorted array
              sortedCount: n
         });

        console.log(`Generated ${steps.length} interaction steps for Selection Sort.`);
        return steps;
    }


    startNewArray() {
        console.log("Starting new Selection Sort array quiz...");
        this.originalArray = this.generateRandomArray(6);
        this.currentArray = [...this.originalArray]; // Keep internal track
        this.steps = this.generateSelectionSortSteps(this.originalArray);
        this.totalSteps = this.steps.filter(step => step.type === 'compare' || step.type === 'place').length; // Count only decision steps
        this.currentStepIndex = 0; // Reset step index

        // Reset quiz state
        this.score = 0;
        this.correctDecisions = 0;
        this.wrongDecisions = 0;
        this.currentStreak = 0;
        this.isActive = true;
        this.progressUpdateSent = false;

        // Start timer
        this.startPracticeTimer();

        // UI Updates
        document.getElementById('question-container').style.display = 'block';
        document.getElementById('welcome-message').style.display = 'none';

        this.showCurrentStep();
        this.updateDisplay();
    }

    showCurrentStep() {
        if (!this.isActive || this.currentStepIndex >= this.steps.length) {
            if (this.isActive) this.completeSort(); // Auto-complete if steps run out
            return;
        }

        let step = this.steps[this.currentStepIndex];

         // Skip non-interactive steps automatically
         while (step && (step.type === 'init_min' || step.type === 'update_min' || step.type === 'no_swap' || step.type === 'completed')) {
             console.log(`Skipping step ${this.currentStepIndex}: ${step.type}`);
             // Visualize the state of these steps briefly? Or just skip? Let's skip for now.
             this.visualizeArray(step); // Visualize the state
             if (step.type === 'completed') {
                  this.completeSort();
                  return;
             }
             this.currentStepIndex++;
             if (this.currentStepIndex >= this.steps.length) {
                  this.completeSort();
                  return;
             }
             step = this.steps[this.currentStepIndex];
         }

        // If after skipping we land on a completed step or end, complete sort
        if (!step || step.type === 'completed' || this.currentStepIndex >= this.steps.length) {
             this.completeSort();
             return;
        }


        // Update UI for the interactive step (compare or place)
        const questionTextEl = document.getElementById('question-text');
        const leftValueEl = document.getElementById('left-value');
        const rightValueEl = document.getElementById('right-value');
        const keepBtn = document.getElementById('keep-current-btn');
        const newBtn = document.getElementById('new-minimum-btn');
        const placeBtn = document.getElementById('place-minimum-btn');

        questionTextEl.textContent = step.question || 'Make your decision:'; // Default text

        if (step.type === 'compare') {
            leftValueEl.textContent = step.currentMinValue;
            rightValueEl.textContent = step.comparingValue;
            keepBtn.style.display = 'inline-flex'; // Use inline-flex for button alignment
            newBtn.style.display = 'inline-flex';
            placeBtn.style.display = 'none';
        } else if (step.type === 'place') {
            leftValueEl.textContent = step.minValue; // Value to be placed
            rightValueEl.textContent = step.swapToIndex; // Target index
            keepBtn.style.display = 'none';
            newBtn.style.display = 'none';
            placeBtn.style.display = 'inline-flex';
        }

        // Update step counter (reflecting interactive steps)
         const decisionStepsCompleted = this.steps.slice(0, this.currentStepIndex).filter(s => s.type === 'compare' || s.type === 'place').length;
        document.getElementById('step-counter').textContent = `Decision ${decisionStepsCompleted + 1} of ${this.totalSteps}`;
        document.getElementById('step-description').textContent = `Pass ${step.pass + 1}: ${step.type === 'compare' ? `Scanning (index ${step.comparingIndex})` : 'Placing Minimum'}`;

        this.visualizeArray(step);

        // Ensure buttons are enabled for the new step
        keepBtn.disabled = false;
        newBtn.disabled = false;
        placeBtn.disabled = false;

        this.clearFeedback();
    }


    visualizeArray(step) {
        const container = document.getElementById('array-view');
        container.innerHTML = ''; // Clear previous view

        const arrayToShow = step.array;
        const sortedCount = step.sortedCount;

        arrayToShow.forEach((value, index) => {
            const cell = document.createElement('div');
            cell.className = 'array-cell';
            cell.textContent = value;

            const indexLabel = document.createElement('div');
            indexLabel.className = 'array-index';
            indexLabel.textContent = index;
            cell.appendChild(indexLabel);

            // Apply classes based on state
            if (index < sortedCount) {
                cell.classList.add('sorted');
            } else {
                 // Highlights for unsorted part
                 if (step.type === 'compare') {
                     if (index === step.currentMinIndex) cell.classList.add('minimum');
                     if (index === step.comparingIndex) cell.classList.add('comparing');
                     if (index === step.pass) cell.classList.add('current'); // Highlight start of unsorted
                 } else if (step.type === 'place') {
                     if (index === step.swapFromIndex) cell.classList.add('minimum'); // Min to be swapped
                     if (index === step.swapToIndex) cell.classList.add('current'); // Target position
                 } else if (step.type === 'init_min' || step.type === 'update_min' || step.type === 'no_swap') {
                      if (index === step.minIndex) cell.classList.add('minimum'); // Show current min
                      if (index === step.pass) cell.classList.add('current'); // Highlight start of unsorted
                 }
            }


            container.appendChild(cell);
        });
         requestAnimationFrame(handleArrayLayout); // Adjust layout if needed
    }

    async makeDecision(userDecision) {
        if (!this.isActive) return;

        let step = this.steps[this.currentStepIndex];

         // Ensure we are on an interactive step
         if (step.type !== 'compare' && step.type !== 'place') {
              console.warn("makeDecision called on non-interactive step:", step.type);
              this.nextStep(); // Skip to the next potential interactive step
              return;
         }


        let isCorrect = false;
        let feedback = '';
        const keepBtn = document.getElementById('keep-current-btn');
        const newBtn = document.getElementById('new-minimum-btn');
        const placeBtn = document.getElementById('place-minimum-btn');

        // Disable all decision buttons
        keepBtn.disabled = true;
        newBtn.disabled = true;
        placeBtn.disabled = true;
        keepBtn.classList.remove('correct', 'wrong');
        newBtn.classList.remove('correct', 'wrong');
        placeBtn.classList.remove('correct', 'wrong');


        if (step.type === 'compare') {
            const correctAnswer = step.shouldUpdateMin ? 'new' : 'keep';
            isCorrect = (userDecision === correctAnswer);

            if (isCorrect) {
                feedback = `Correct! ${step.shouldUpdateMin ? ` ${step.comparingValue} is the new minimum.` : `${step.currentMinValue} remains the minimum.`}`;
                if (userDecision === 'new') newBtn.classList.add('correct');
                else keepBtn.classList.add('correct');
            } else {
                feedback = `Incorrect. ${step.shouldUpdateMin ? `${step.comparingValue} < ${step.currentMinValue}, so it's the new minimum.` : `${step.currentMinValue} <= ${step.comparingValue}, so keep the current minimum.`}`;
                if (userDecision === 'new') newBtn.classList.add('wrong');
                else keepBtn.classList.add('wrong');
                // Highlight the correct button
                if (correctAnswer === 'new') newBtn.classList.add('correct');
                else keepBtn.classList.add('correct');
            }

        } else if (step.type === 'place') {
             // For 'place' step, the only correct action is 'place'
            isCorrect = (userDecision === 'place');

            if (isCorrect) {
                feedback = `Correct! Placing minimum ${step.minValue} at index ${step.swapToIndex}.`;
                placeBtn.classList.add('correct');

                // Perform swap visually and update internal array state
                await this.animateSwap(step.swapFromIndex, step.swapToIndex);
                [this.currentArray[step.swapFromIndex], this.currentArray[step.swapToIndex]] =
                [this.currentArray[step.swapToIndex], this.currentArray[step.swapFromIndex]];

            } else {
                 // This case shouldn't happen if only 'place' button is shown, but handle defensively
                 feedback = `Incorrect. The minimum ${step.minValue} should be placed at index ${step.swapToIndex}.`;
                 // Since only 'place' button is visible, user couldn't have clicked wrong button
                 // If somehow reached here, show placeBtn as correct anyway
                  placeBtn.classList.add('correct'); // Show what should have happened
            }
        }

        // Update stats
        if (isCorrect) {
            this.score += 10; // Simple scoring
            this.correctDecisions++;
            this.currentStreak++;
            this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
        } else {
            this.wrongDecisions++;
            this.currentStreak = 0;
        }

        this.showFeedback(feedback, isCorrect ? 'correct' : 'wrong');
        this.updateDisplay(); // Update score/accuracy display

        // Wait before proceeding
        const delay = (step.type === 'place' && isCorrect) ? 1000 : 1500; // Shorter delay after swap animation
        setTimeout(() => {
            if (this.isActive) {
                this.nextStep();
            }
        }, delay);
    }

    async animateSwap(fromIndex, toIndex) {
        const cells = document.querySelectorAll('#array-view .array-cell');
        const fromCell = cells[fromIndex];
        const toCell = cells[toIndex];

        if (fromCell && toCell && fromIndex !== toIndex) {
            fromCell.classList.add('swapping'); // Add classes for potential styling/animation
            toCell.classList.add('swapping');

             // Simple visual swap using transforms (can reuse bubble sort animation logic if preferred)
             const rectFrom = fromCell.getBoundingClientRect();
             const rectTo = toCell.getBoundingClientRect();
             const deltaX = rectTo.left - rectFrom.left;
             const liftY = -30; // Lift amount

             fromCell.style.position = 'relative'; toCell.style.position = 'relative';
             fromCell.style.zIndex = '10'; toCell.style.zIndex = '5'; // Ensure 'from' is on top

             // Lift
             fromCell.style.transition = 'transform 0.15s ease-out';
             toCell.style.transition = 'transform 0.15s ease-out';
             fromCell.style.transform = `translateY(${liftY}px)`;
             toCell.style.transform = `translateY(${liftY}px)`;

             await new Promise(resolve => setTimeout(resolve, 150));

             // Slide
             fromCell.style.transition = 'transform 0.3s ease-in-out';
             toCell.style.transition = 'transform 0.3s ease-in-out';
             fromCell.style.transform = `translateX(${deltaX}px) translateY(${liftY}px)`;
             toCell.style.transform = `translateX(${-deltaX}px) translateY(${liftY}px)`;

             await new Promise(resolve => setTimeout(resolve, 300));

             // Settle
             fromCell.style.transition = 'transform 0.2s ease-in';
             toCell.style.transition = 'transform 0.2s ease-in';
             fromCell.style.transform = `translateX(${deltaX}px) translateY(0)`;
             toCell.style.transform = `translateX(${-deltaX}px) translateY(0)`;

             await new Promise(resolve => setTimeout(resolve, 200));


            // --- IMPORTANT: Update the text content visually AFTER animation ---
             const getNodeText = (node) => node.childNodes[0]?.textContent?.trim() ?? '';
             const fromValueText = getNodeText(fromCell);
             const toValueText = getNodeText(toCell);

             // Find text nodes (usually the first child node)
             const fromTextNode = fromCell.firstChild;
             const toTextNode = toCell.firstChild;

              if (fromTextNode && fromTextNode.nodeType === Node.TEXT_NODE) fromTextNode.textContent = toValueText;
              if (toTextNode && toTextNode.nodeType === Node.TEXT_NODE) toTextNode.textContent = fromValueText;
             // --- End visual text update ---


            // Cleanup styles
            fromCell.style.transition = ''; toCell.style.transition = '';
            fromCell.style.transform = ''; toCell.style.transform = '';
            fromCell.style.position = ''; toCell.style.position = '';
            fromCell.style.zIndex = ''; toCell.style.zIndex = '';

            fromCell.classList.remove('swapping');
            toCell.classList.remove('swapping');
        } else {
             console.error(`Could not find cells for swap animation: indices ${fromIndex}, ${toIndex}`);
        }
    }


    nextStep() {
        if (!this.isActive) return;

        // Clean up button visual states
        document.getElementById('keep-current-btn').classList.remove('correct', 'wrong');
        document.getElementById('new-minimum-btn').classList.remove('correct', 'wrong');
        document.getElementById('place-minimum-btn').classList.remove('correct', 'wrong');

        this.currentStepIndex++; // Move to the raw next step index

        if (this.currentStepIndex < this.steps.length) {
            this.showCurrentStep(); // showCurrentStep handles skipping non-interactive steps
        } else {
            this.completeSort(); // Should be triggered by the 'completed' step type in showCurrentStep
        }

        this.clearFeedback();
    }

     completeSort() {
         if (!this.isActive) {
             console.log("completeSort called but quiz is already inactive.");
             return;
         }

         this.isActive = false;
         const timeTakenSeconds = this.stopPracticeTimer();

         // Accuracy based on decision steps
         const decisionStepsTotal = this.totalSteps; // Already calculated
         const accuracy = decisionStepsTotal > 0
             ? Math.round((this.correctDecisions / decisionStepsTotal) * 100)
             : 0;

         // Update local storage
         localStorage.setItem('selectionSortBestStreak', this.bestStreak.toString());
         this.arraysSorted = parseInt(localStorage.getItem('selectionSortArraysSorted') || '0') + 1;
         localStorage.setItem('selectionSortArraysSorted', this.arraysSorted.toString());

         // Send progress update
         if (!this.progressUpdateSent) {
              console.log(`Sending final progress: Accuracy=${accuracy}, Time=${timeTakenSeconds}s, Score=${this.score}`);
              sendPracticeProgressUpdate(accuracy, timeTakenSeconds, this.correctDecisions, this.wrongDecisions, this.score);
              this.progressUpdateSent = true;
         }

         // Ensure final array is visualized
         const finalStep = this.steps[this.steps.length - 1]; // Get the last step ('completed')
         if (finalStep && finalStep.type === 'completed') {
             this.visualizeFinalArray(finalStep.array); // Visualize the final state from the last step
         } else {
              // Fallback: sort the original array manually if last step isn't 'completed'
              console.warn("Last step was not 'completed', manually sorting original array for final display.");
              const finalSortedArray = [...this.originalArray].sort((a, b) => a - b); // Ascending sort
              this.visualizeFinalArray(finalSortedArray);
         }

         this.showCompletionModal(accuracy, timeTakenSeconds);
         this.updateDisplay(); // Update UI to final state (100% progress etc.)
     }


    visualizeFinalArray(sortedArray) {
        const container = document.getElementById('array-view');
        container.innerHTML = ''; // Clear

        sortedArray.forEach((value, index) => {
            const cell = document.createElement('div');
            cell.className = 'array-cell sorted'; // Mark all as sorted
            cell.textContent = value;

            const indexLabel = document.createElement('div');
            indexLabel.className = 'array-index';
            indexLabel.textContent = index;
            cell.appendChild(indexLabel);

            container.appendChild(cell);
        });

        // Update step info for completion
        document.getElementById('step-counter').textContent = 'Completed!';
        document.getElementById('step-description').textContent = 'Array is now sorted.';
    }


    showCompletionModal(accuracy, timeTaken) {
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-accuracy').textContent = `${accuracy}%`;
        document.getElementById('total-steps').textContent = this.totalSteps; // Show decision steps count
        document.getElementById('time-taken').textContent = `${timeTaken}s`;

        let message = '';
        if (accuracy >= 90) message = '🥇 Excellent! Selection Sort mastered!';
        else if (accuracy >= 75) message = '🥈 Good job! Strong understanding.';
        else if (accuracy >= 60) message = '🥉 Keep practicing the minimum finding!';
        else message = '💪 Review the steps! Find the minimum in the unsorted part each time.';
        document.getElementById('performance-message').textContent = message;

        const modal = document.getElementById('completion-modal');
        if (modal) modal.classList.add('show');
    }

    hideModal() {
        const modal = document.getElementById('completion-modal');
        if (modal) modal.classList.remove('show');
    }

    sortAnother() {
        this.hideModal();
        this.startNewArray();
    }

    viewResults() {
        this.hideModal(); // Just close, final array is visible
    }

    showFeedback(message, type) {
        const feedback = document.getElementById('feedback');
        if (!feedback) return;
        feedback.textContent = message;
        feedback.className = 'feedback'; // Reset classes
        feedback.classList.add(type, 'show');
    }

    clearFeedback() {
        const feedback = document.getElementById('feedback');
         if (!feedback) return;
        feedback.className = 'feedback';
        feedback.textContent = '';
    }

    updateDisplay() {
        // Safely update elements
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

        // Accuracy based on decisions made so far
        const totalDecisionsMade = this.correctDecisions + this.wrongDecisions;
        const currentAccuracy = totalDecisionsMade > 0 ? Math.round((this.correctDecisions / totalDecisionsMade) * 100) : 0;
        if (accuracyEl) accuracyEl.textContent = `${currentAccuracy}%`;

        // Progress based on decision steps completed vs total decision steps
        const decisionStepsCompleted = this.steps.slice(0, this.currentStepIndex).filter(s => s.type === 'compare' || s.type === 'place').length;
        const progressPercent = this.totalSteps > 0 ? (decisionStepsCompleted / this.totalSteps) * 100 : (this.isActive ? 0 : 100);

        if (progressFillEl) progressFillEl.style.width = `${progressPercent}%`;
        if (progressTextEl) progressTextEl.textContent = `${decisionStepsCompleted} / ${this.totalSteps} decisions`;

        if (correctDecisionsEl) correctDecisionsEl.textContent = this.correctDecisions;
        if (wrongDecisionsEl) wrongDecisionsEl.textContent = this.wrongDecisions;

        if (currentStreakEl) currentStreakEl.textContent = this.currentStreak;
        if (bestStreakEl) bestStreakEl.textContent = localStorage.getItem('selectionSortBestStreak') || '0';
        if (arraysSortedEl) arraysSortedEl.textContent = localStorage.getItem('selectionSortArraysSorted') || '0';
    }


    resetQuiz() {
        console.log("Resetting Selection Sort quiz...");
        this.isActive = false;
        this.stopPracticeTimer();

        // Reset state
        this.currentStepIndex = 0;
        this.score = 0; this.correctDecisions = 0; this.wrongDecisions = 0; this.currentStreak = 0;
        this.totalSteps = 0; this.steps = []; this.currentArray = []; this.originalArray = [];
        this.progressUpdateSent = false;

        // Reset UI
        document.getElementById('question-container').style.display = 'none';
        document.getElementById('welcome-message').style.display = 'block';
        document.getElementById('array-view').innerHTML = '';
        document.getElementById('step-counter').textContent = 'Ready to start';
        document.getElementById('step-description').textContent = 'Click "Start New Array"';

        // Reset buttons
        const keepBtn = document.getElementById('keep-current-btn');
        const newBtn = document.getElementById('new-minimum-btn');
        const placeBtn = document.getElementById('place-minimum-btn');
        keepBtn.disabled = true; newBtn.disabled = true; placeBtn.disabled = true;
        keepBtn.classList.remove('correct', 'wrong');
        newBtn.classList.remove('correct', 'wrong');
        placeBtn.classList.remove('correct', 'wrong');

        this.updateDisplay(); // Update counters/progress to 0
        this.clearFeedback();
    }

    backToMain() {
        console.log("Navigating back to main visualization.");
        this.stopPracticeTimer(); // Stop timer before leaving
        // Optionally send partial progress if needed
        // sendPracticeProgressUpdate(...)
        window.location.href = "index.html"; // Assumes index.html is the main viz page
    }
}

// --- Initialize Quiz (Called after access check) ---
function initializePracticeQuiz() {
    console.log("Initializing Selection Sort Practice Quiz page content...");

    // Instantiate the quiz class
    const quizInstance = new SelectionSortStepQuiz();

    // Setup UI elements and listeners controlled by the class
    quizInstance.setupEventListeners();
    quizInstance.setupTheme();
    quizInstance.updateDisplay(); // Initial display update


    // Move Ripple effect setup here
    document.addEventListener('click', function (e) {
        // Ensure the clicked element is a button and not disabled
        if (e.target.tagName === 'BUTTON' && !e.target.disabled) {
            const button = e.target;
            // Calculate ripple position and size
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height) * 1.5; // Ripple size
            const x = e.clientX - rect.left - size / 2; // X position inside button
            const y = e.clientY - rect.top - size / 2; // Y position inside button

            // Create ripple element
            const ripple = document.createElement('span');
            ripple.className = 'ripple'; // Add class for styling
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';

            // Append ripple and set timeout for removal
            button.appendChild(ripple);
            setTimeout(() => {
                // Ensure ripple still exists and has a parent before removing
                if (ripple.parentNode) {
                    ripple.parentNode.removeChild(ripple);
                }
            }, 600); // Duration matches CSS animation
        }
    });


    console.log("Selection Sort Practice Quiz page fully initialized after access check.");
}

// --- RunCode Function ---
function RunCode(){
  console.log("Redirecting to visualization page.");
  window.location.href = "index.html"; // Adjust path if needed
}

// --- Send Progress Update Function ---
async function sendPracticeProgressUpdate(accuracy, timeSpentSeconds, correctCount, wrongCount, finalScore) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.error('No auth token found for practice progress.');
        alert('You must be logged in to save your progress.');
        return;
    }

    // --- Point Calculation Logic (Example) ---
    let points = Math.max(0, finalScore); // Base points
    if (accuracy === 100) points += 25; // Bonus for perfect
    if (timeSpentSeconds < 45 && accuracy >= 80) points += 15; // Speed bonus
    else if (timeSpentSeconds < 90 && accuracy >= 70) points += 5;
    // --- End Point Calculation ---

    const progressData = {
        category: 'sorting',        // Topic ID
        algorithm: 'selectionSort', // Algorithm ID
        data: {
            completed: true,
            accuracyPractice: accuracy,
            timeSpentPractice: timeSpentSeconds, // Send time for this attempt
            attemptsPractice: 1, // Send 1 for this attempt
            pointsPractice: points,
            lastAttemptPractice: new Date()
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
            console.error('Backend error response:', result);
            throw new Error(result.message || `HTTP error ${response.status}`);
        }

        console.log('Practice progress updated successfully on backend:', result);

    } catch (error) {
        console.error('Error sending practice progress update:', error);
        alert(`Error saving progress: ${error.message}.`);
    }

}
