
// --- Define Constants First ---
const API_BASE_URL = '/api'; // Make sure this matches your backend setup

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
        // Now API_BASE_URL is guaranteed to be defined here
        const accessResponse = await fetch(`${API_BASE_URL}/auth/check-access/${topicId}/${algorithmId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!accessResponse.ok) {
            // Handle HTTP errors (like 401 Unauthorized, 404 Not Found, 500 Server Error)
            let errorMsg = `HTTP error ${accessResponse.status}`;
            try {
                const errorData = await accessResponse.json();
                errorMsg = errorData.message || errorMsg;
            } catch (e) { /* Ignore if response is not JSON */ }

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
            console.log('Access granted to bubbleSort.');
            // Access granted, initialize the page content *after* check completes
            initializePageContent();
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
    // Clear potentially invalid token before redirecting
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = '../../auth.html'; // Adjust path if needed
}

function redirectToDashboard() {
    window.location.href = '../../dashboard.html'; // Adjust path if needed
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear authentication tokens/user data from localStorage
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser'); // Remove user details if stored

        // Redirect to the login page
        // Adjust the path as necessary based on your file structure
        window.location.href = '../../auth.html';
    }
}

// Bubble sort source code lines (for code highlighting)
const bubbleSortCodeLines = [
    "", // Line 1 is empty for better indexing
    "function bubbleSort(arr) {", // Line 2
    "  let n = arr.length;", // Line 3
    "  for (let i = 0; i < n - 1; i++) {", // Line 4
    "    let swapped = false;", // Line 5 (Optimization)
    "    for (let j = 0; j < n - i - 1; j++) {", // Line 6
    "      if (arr[j] > arr[j + 1]) {", // Line 7
    "        // Swap arr[j] and arr[j+1]", // Line 8
    "        let temp = arr[j];", // Line 9
    "        arr[j] = arr[j + 1];", // Line 10
    "        arr[j + 1] = temp;", // Line 11
    "        swapped = true;", // Line 12 (Optimization)
    "      }", // Line 13
    "    }", // Line 14
    "    // If no swaps occurred, array is sorted", // Line 15 (Optimization)
    "    if (!swapped) break;", // Line 16 (Optimization)
    "  }", // Line 17
    "  return arr;", // Line 18
    "}" // Line 19
];


// DOM Elements
const arrayInput = document.getElementById("array-input");
const numberCountSpan = document.getElementById("number-count");
const startBtn = document.getElementById("start-btn");
const orderSelect = document.getElementById("order-select");
const arrayView = document.getElementById("array-view");
const variableState = document.getElementById("variable-state");
const stepDesc = document.getElementById("step-desc");
const timeComplexitySpan = document.getElementById("time-complexity");
const spaceComplexitySpan = document.getElementById("space-complexity");
const resultSpan = document.getElementById("result");
const prevBtn = document.getElementById("prev-step");
const nextBtn = document.getElementById("next-step");
const pausePlayBtn = document.getElementById("pause-play-btn");
const speedSlider = document.getElementById("speed-slider");
const speedValue = document.getElementById("speed-value");
const codeBlock = document.getElementById("code-block");

// State variables
let array = [];
let detailedSteps = [];
let compactSteps = [];
let steps = []; // current steps (detailed or compact)
let currentStep = 0;
let autoplayTimer = null;
let isPlaying = false;
let stepMode = "detailed";
let isSwapping = false; // lock UI during animation

// Add these variables for time tracking
let startTime = null;
let elapsedTime = 0; // in seconds
let intervalId = null;
let progressSentForThisView = false; // Flag to prevent multiple sends
// --- End Timer Variables ---

// Map speed slider (1-100) to delay ms
function calcAutoplayDelay(val) {
    // Linear mapping: 1=2000ms, 100=50ms
    // Adjust the range (2000, 50) as needed
    return Math.round(2000 - 1950 * (val - 1) / 99);
}
let autoplayDelay = calcAutoplayDelay(parseInt(speedSlider.value, 10));
speedValue.textContent = `${speedSlider.value}`;

// --- Timer Functions ---
function startTimer() {
    if (startTime) return; // Don't restart if already running
    startTime = Date.now();
    elapsedTime = 0; // Reset elapsed time when starting
    if (intervalId) clearInterval(intervalId); // Clear any existing timer just in case
    console.log("Timer started.");
    intervalId = setInterval(() => {
        if (startTime) {
            elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        } else {
            clearInterval(intervalId); // Stop interval if startTime became null
            intervalId = null;
        }
    }, 1000);
}

function stopTimer() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log("Timer stopped.");
    }
    if (startTime) {
        // Calculate final elapsed time one last time
        elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        startTime = null; // Mark timer as stopped
        console.log(`Final elapsed time recorded: ${elapsedTime}s`);
    }
    return elapsedTime; // Return total time spent in seconds
}
// --- End Timer Functions ---

// --- Theme Management ---
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'dark'; // Default to dark
        this.init();
    }
    init() {
        this.applyTheme();
        this.setupToggle();
    }
    applyTheme() {
        document.body.setAttribute('data-theme', this.theme);
        this.updateToggleIcon();
        // ** Update chart colors if chart exists **
        if (window.myComplexityChart) { // Check if chart exists
            updateChartTheme(window.myComplexityChart); // Call the update function
        }
        if (window.mySpaceComplexityChart) { // ADD THIS
            updateSpaceChartTheme(window.mySpaceComplexityChart); // Update space complexity chart
        }
    }
    updateToggleIcon() {
        const toggleBtn = document.getElementById('theme-toggle-btn');
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('.theme-icon');
            if (icon) icon.textContent = this.theme === 'dark' ? '☀️' : '🌙';
        }
    }
    setupToggle() {
        const toggleBtn = document.getElementById('theme-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleTheme());
        }
    }
    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', this.theme);
        this.applyTheme();
    }
}
// --- End Theme Management ---

// --- Helper Functions ---
function handleArrayLayout() {
    const container = document.querySelector('.array-container');
    const arrayViewDiv = document.getElementById('array-view');
    if (!container || !arrayViewDiv) return;

    const isScrollable = arrayViewDiv.scrollWidth > container.clientWidth;
    container.classList.toggle('scrollable', isScrollable);

    if (isScrollable) {
        const isAtStart = container.scrollLeft < 5;
        const isAtEnd = container.scrollLeft >= container.scrollWidth - container.clientWidth - 5;
        container.classList.toggle('scrolled-start', !isAtStart);
        container.classList.toggle('scrolled-end', isAtEnd);
    } else {
        container.classList.remove('scrolled-start', 'scrolled-end');
    }
}


function findCorrespondingStep(fromSteps, toSteps, currentIdx) {
    if (!fromSteps || !toSteps || fromSteps.length === 0 || toSteps.length === 0) return 0; // Handle empty arrays
    if (currentIdx >= fromSteps.length) return Math.max(0, toSteps.length - 1);
    if (currentIdx < 0) return 0;

    const currentStepData = fromSteps[currentIdx];
    if (!currentStepData) return Math.floor(currentIdx / (fromSteps.length || 1) * toSteps.length); // Fallback

    // Try precise matching first (type, i, j)
    let bestMatch = -1;
    for (let idx = 0; idx < toSteps.length; idx++) {
        const targetStep = toSteps[idx];
        if (targetStep.type === currentStepData.type && targetStep.i === currentStepData.i && targetStep.j === currentStepData.j) {
            bestMatch = idx;
            // Prioritize start/compare steps
            if (currentStepData.type?.includes('start') || currentStepData.type?.includes('compare')) {
                break;
            }
        }
    }
    if (bestMatch !== -1) return bestMatch;

    // Fallback: Match based on i and j only
    for (let idx = 0; idx < toSteps.length; idx++) {
        const targetStep = toSteps[idx];
        if (targetStep.i === currentStepData.i && targetStep.j === currentStepData.j) {
            return idx; // Take the first i,j match
        }
    }

    // Final Fallback: estimate position
    console.warn(`Could not find step match for index ${currentIdx}, estimating position.`);
    const progress = currentIdx / fromSteps.length;
    return Math.min(toSteps.length - 1, Math.max(0, Math.floor(progress * toSteps.length)));
}

// --- Step Description Generation ---
function createStepDescription(type, data) {
    const { i, j, a, order, orderText, comparisonText, compareFunc, n, swapped } = data || {};

    // Basic check for essential data in some types
    if ((type === 'comparing' || type === 'swap-step') && (a === undefined || j === undefined)) return '<p>Error generating description: Missing data.</p>';
    if ((type === 'pass-start' || type === 'inner-loop-complete') && (i === undefined || a === undefined || n === undefined)) return '<p>Error generating description: Missing data.</p>';


    switch (type) {
        case 'start': // Conceptual start
            return `<div class="step-header"><span class="step-icon">🏁</span> <h4 class="step-title">Start Bubble Sort</h4></div><div class="step-section"><div class="section-content">Beginning the sorting process.</div></div>`;
        case 'init': // Line 3
            return `<div class="step-header"><span class="step-icon">🔢</span> <h4 class="step-title">Initialize Length</h4></div><div class="step-section"><div class="section-label">Line 3</div><div class="section-content">Set variable n = ${n ?? '?'} (length of the array).</div></div>`;
        case 'pass-start': // Line 4
            return `
            <div class="step-header"><span class="step-icon">🔄</span> <h4 class="step-title">Pass ${i + 1} Started</h4></div>
            <div class="step-section"><div class="section-label">Line 4</div><div class="section-content">Starting outer loop (pass) with i = ${i}. This pass will place the next ${order === "asc" ? "largest" : "smallest"} element correctly.</div></div>
            <div class="step-section"><div class="section-label">Objective</div><div class="section-content">Ensure element at index ${n - 1 - i} is sorted. Comparisons will go up to index ${n - i - 2}.</div></div>`;
        case 'flag-init': // Line 5
            return `<div class="step-header"><span class="step-icon">🚩</span> <h4 class="step-title">Initialize Swap Flag</h4></div><div class="step-section"><div class="section-label">Line 5</div><div class="section-content">Set swapped = false at the start of Pass ${i + 1}. Used for optimization.</div></div>`;
        case 'inner-loop-start': // Line 6
            return `
            <div class="step-header"><span class="step-icon">🔍</span> <h4 class="step-title">Inner Loop - Compare Indices ${j} & ${j + 1}</h4></div>
            <div class="step-section"><div class="section-label">Line 6</div><div class="section-content">Starting inner loop comparison at index j = ${j}.</div></div>`;
        case 'comparing': // Line 7 (Condition Check)
            if (!a || a[j] === undefined || a[j + 1] === undefined || typeof compareFunc !== 'function') return `<p>Error comparing: Invalid data.</p>`;
            const needsSwap = compareFunc(a[j], a[j + 1]);
            return `
            <div class="step-header"><span class="step-icon">⚖️</span> <h4 class="step-title">Comparing Elements</h4></div>
            <div class="step-section"><div class="section-label">Condition (Line 7)</div><div class="section-content">Check if arr[${j}] (${a[j]}) ${order === "asc" ? ">" : "<"} arr[${j + 1}] (${a[j + 1]}).</div></div>
            <div class="step-section"><div class="section-label">Result</div><div class="section-content"><div class="comparison-result ${needsSwap ? 'result-true' : 'result-false'}">${needsSwap ? `✓ Condition is true (${a[j]} ${comparisonText ?? '?'} ${a[j + 1]}). Swap needed.` : `✗ Condition is false. No swap needed.`}</div></div></div>`;
        case 'swapping': // Animated Swap (Conceptual Lines 8-11)
            return `
            <div class="step-header"><span class="step-icon">↔️</span> <h4 class="step-title">Swapping Elements</h4></div>
            <div class="step-section"><div class="section-label">Action (Lines 9-11)</div><div class="section-content">Swapping values at index ${j} (${data.preSwapA ?? '?'}) and index ${j + 1} (${data.preSwapB ?? '?'}).</div></div>`;
        case 'swap-step': // Detailed Swap Steps
            const { step, stepDesc: swapStepDesc } = data; // Renamed stepDesc to avoid conflict
            const lineMap = { 1: 9, 2: 10, 3: 11 };
            return `
            <div class="step-header"><span class="step-icon">⚙️</span> <h4 class="step-title">Swap Step ${step} (Line ${lineMap[step]})</h4></div>
            <div class="step-section"><div class="section-label">Process</div><div class="section-content">${swapStepDesc ?? ''}</div></div>`;
        case 'flag-set': // Line 12
            return `<div class="step-header"><span class="step-icon">🚩</span> <h4 class="step-title">Update Swap Flag</h4></div><div class="step-section"><div class="section-label">Line 12</div><div class="section-content">Set swapped = true because a swap occurred in this pass.</div></div>`;
        case 'end-if': // Line 13 (End of if block)
            return `<div class="step-header"><span class="step-icon">➡️</span> <h4 class="step-title">Continue Inner Loop</h4></div><div class="step-section"><div class="section-label">Flow (After Line 13)</div><div class="section-content">Moving to the next inner loop iteration (j = ${j + 1}).</div></div>`;
        case 'inner-loop-complete': // Line 14 (End of inner loop)
            return `
            <div class="step-header"><span class="step-icon">🏁</span> <h4 class="step-title">Inner Loop Finished for Pass ${i + 1}</h4></div>
            <div class="step-section"><div class="section-label">Line 14</div><div class="section-content">Completed all comparisons for this pass. Element at index ${n - 1 - i} is now in its sorted position.</div></div>`;
        case 'check-swap-flag': // Line 16 (Optimization Check)
            return `
            <div class="step-header"><span class="step-icon">⏱️</span> <h4 class="step-title">Check Optimization</h4></div>
            <div class="step-section"><div class="section-label">Condition (Line 16)</div><div class="section-content">Check if swapped is false. Current value: <strong>${swapped}</strong>.</div></div>`;
        case 'early-termination': // Line 16 (Break)
            return `
              <div class="step-header"><span class="step-icon">⚡</span> <h4 class="step-title">Early Termination</h4></div>
              <div class="step-section"><div class="section-label">Action (Line 16)</div><div class="section-content">Since swapped is false, the array is already sorted. Breaking the outer loop.</div></div>`;
        case 'pass-complete': // Line 17 (End of outer loop iteration)
            return `
            <div class="pass-complete-display">
              <div class="pass-complete-title">🎯 Pass ${i + 1} Complete! (End of Line 17)</div>
              <div class="pass-complete-details">Element at index ${n - 1 - i} (value ${a?.[n - 1 - i] ?? '?'}) is sorted. Proceeding to next pass (i = ${i + 1}).</div>
            </div>`;
        case 'sorting-complete': // Line 18/19 or after early termination
            const endLine = data?.terminatedEarly ? 17 : 19; // Corrected line numbers
            const finalSortedArray = Array.isArray(a) ? a.join(", ") : 'Error';
            return `
            <div class="final-result-display">
              <div class="final-result-title">🎉 Sorting Complete! (After Line ${endLine})</div>
              <div class="step-section"><div class="section-label">Result</div><div class="section-content">The array is now fully sorted in ${orderText ?? '?'} order. <div class="final-array-display">[${finalSortedArray}]</div></div></div>
            </div>`;
        default: return `<p>Loading description...</p>`;
    }
}

// --- prepareBubbleSortSteps ---
function prepareBubbleSortSteps(arr, order = "asc") {
    let a = arr.slice();
    const n = a.length;
    let detailed = [];
    let compact = [];
    let sortedIndices = Array(n).fill(false);
    const compareFunc = order === "asc" ? (x, y) => x > y : (x, y) => x < y;
    const orderText = order === "asc" ? "ascending" : "descending";
    const comparisonText = order === "asc" ? ">" : "<"; // Use symbol for comparison text

    detailed.push({ type: 'start', a: a.slice(), i: null, j: null, compare: [], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('start', {}), codeLines: [2], done: false });
    compact.push(detailed[detailed.length - 1]);

    detailed.push({ type: 'init', a: a.slice(), i: null, j: null, compare: [], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('init', { n }), codeLines: [3], done: false });
    compact.push(detailed[detailed.length - 1]);

    outerLoop:
    for (let i = 0; i < n - 1; i++) {
        detailed.push({ type: 'pass-start', a: a.slice(), i, j: null, compare: [], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('pass-start', { i, a: a.slice(), order, orderText, n }), codeLines: [4], done: false });
        compact.push(detailed[detailed.length - 1]);

        let swapped = false;
        detailed.push({ type: 'flag-init', a: a.slice(), i, j: null, compare: [], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('flag-init', { i }), codeLines: [5], done: false });
        compact.push(detailed[detailed.length - 1]);

        for (let j = 0; j < n - i - 1; j++) {
            detailed.push({ type: 'inner-loop-start', a: a.slice(), i, j, compare: [], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('inner-loop-start', { i, j, orderText }), codeLines: [6], done: false });
            // Don't add inner-loop-start to compact, combine with comparing

            const preCompareState = a.slice();
            const needsSwap = compareFunc(a[j], a[j + 1]);
            const comparingDesc = createStepDescription('comparing', { i, j, a: preCompareState, order, orderText, comparisonText, compareFunc });

            detailed.push({ type: 'comparing', a: preCompareState, i, j, compare: [j, j + 1], swap: [], sorted: sortedIndices.slice(), desc: comparingDesc, codeLines: [7], done: false });
            // Add comparing step to compact as well
            compact.push({ type: 'comparing', a: preCompareState, i, j, compare: [j, j + 1], swap: [], sorted: sortedIndices.slice(), desc: comparingDesc, codeLines: [7], done: false });


            if (needsSwap) {
                const preSwapA = a[j];
                const preSwapB = a[j + 1];
                [a[j], a[j + 1]] = [a[j + 1], a[j]];
                const postSwapState = a.slice();
                const swappingDesc = createStepDescription('swapping', { i, j, a: postSwapState, orderText, preSwapA, preSwapB });

                // Detailed swap steps
                detailed.push({ type: 'swap-step', a: postSwapState, i, j, compare: [], swap: [j, j + 1], sorted: sortedIndices.slice(), desc: createStepDescription('swap-step', { step: 1, stepDesc: `Store original arr[${j}] (value ${preSwapA}) in 'temp'.` }), codeLines: [9], animateSwapStep: false, done: false });
                detailed.push({ type: 'swap-step', a: postSwapState, i, j, compare: [], swap: [j, j + 1], sorted: sortedIndices.slice(), desc: createStepDescription('swap-step', { step: 2, stepDesc: `Set arr[${j}] = original arr[${j + 1}] (value ${a[j]}).` }), codeLines: [10], animateSwapStep: false, done: false });
                detailed.push({ type: 'swap-step', a: postSwapState, i, j, compare: [], swap: [j, j + 1], sorted: sortedIndices.slice(), desc: createStepDescription('swap-step', { step: 3, stepDesc: `Set arr[${j + 1}] = temp (value ${a[j + 1]}).` }), codeLines: [11], animateSwapStep: false, done: false });

                // Compact swap step (includes animation trigger)
                compact.push({ type: 'swap', a: postSwapState, i, j, compare: [], swap: [j, j + 1], sorted: sortedIndices.slice(), desc: swappingDesc, codeLines: [8, 9, 10, 11], isCombined: true, animateSwapStep: true, done: false });

                swapped = true;
                detailed.push({ type: 'flag-set', a: postSwapState, i, j, compare: [], swap: [j, j + 1], sorted: sortedIndices.slice(), desc: createStepDescription('flag-set', { i }), codeLines: [12], done: false });
                compact.push(detailed[detailed.length - 1]); // Add flag set to compact
            }

            detailed.push({ type: 'end-if', a: a.slice(), i, j, compare: [], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('end-if', { i, j }), codeLines: [13], done: false });
            // Don't add end-if to compact

        } // End inner loop

        const currentInnerLoopEndState = a.slice();
        if (n - 1 - i >= 0) { sortedIndices[n - 1 - i] = true; }

        detailed.push({ type: 'inner-loop-complete', a: currentInnerLoopEndState, i, j: null, compare: [], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('inner-loop-complete', { i, a: currentInnerLoopEndState, n }), codeLines: [14], done: false });
        compact.push(detailed[detailed.length - 1]);

        detailed.push({ type: 'check-swap-flag', a: currentInnerLoopEndState, i, j: null, compare: [], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('check-swap-flag', { i, swapped }), codeLines: [16], done: false });
        compact.push(detailed[detailed.length - 1]);

        if (!swapped) {
            const finalSortedForTerm = a.slice();
            sortedIndices.fill(true);
            const finalDesc = createStepDescription('early-termination', { i }) + createStepDescription('sorting-complete', { a: finalSortedForTerm, orderText, terminatedEarly: true });
            const terminationStep = { type: 'early-termination', a: finalSortedForTerm, i, j: null, compare: [], swap: [], sorted: sortedIndices.slice(), desc: finalDesc, done: true, codeLines: [16] };
            detailed.push(terminationStep);
            compact.push(terminationStep);
            break outerLoop;
        }

        detailed.push({ type: 'pass-complete', a: a.slice(), i, j: null, compare: [], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('pass-complete', { i, a: a.slice(), orderText, n }), codeLines: [17], passComplete: true, passNumber: i + 1, done: false });
        compact.push(detailed[detailed.length - 1]);

    } // End outer loop

    const lastDetailedStep = detailed[detailed.length - 1];
    if (!lastDetailedStep || !lastDetailedStep.done) {
        sortedIndices.fill(true);
        const finalArrayState = arr.slice().sort((x, y) => order === 'asc' ? x - y : y - x);
        const finalStep = { type: 'sorting-complete', a: finalArrayState, i: null, j: null, compare: [], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('sorting-complete', { a: finalArrayState, orderText, terminatedEarly: false }), done: true, codeLines: [18, 19] };
        detailed.push(finalStep);
        compact.push(finalStep);
    }

    return { detailedSteps: detailed, compactSteps: compact };
}


// Live array visualization as user types
function createLiveArrayVisualization() {
    arrayView.innerHTML = "";
    const raw = arrayInput.value.trim();
    let numbers = [];

    if (raw.length === 0) {
        const emptyBox = document.createElement("div");
        emptyBox.classList.add("array-cell", "empty-cell");
        emptyBox.innerHTML = `<span style="color: var(--text-muted-light); font-size: 0.875rem;">?</span><div class="array-index">0</div>`;
        arrayView.appendChild(emptyBox);
        numberCountSpan.textContent = `Numbers in Array: 0`;
        numberCountSpan.style.color = "var(--text-muted-light)";
    } else {
        const rawNumbers = raw.split(",")
            .map(s => s.trim())
            .filter(s => s.length > 0);

        numberCountSpan.textContent = `Numbers in Array: ${rawNumbers.length}`;
        const tooMany = rawNumbers.length > 10;
        numberCountSpan.style.color = tooMany ? "var(--error)" : "var(--text-muted-light)";

        numbers = rawNumbers.slice(0, 10); // Only take the first 10

        numbers.forEach((numStr, idx) => {
            const div = document.createElement("div");
            div.classList.add("array-cell");
            const num = Number(numStr);
            if (isNaN(num) || numStr === "") {
                div.classList.add("invalid-cell");
                div.textContent = "?";
            } else {
                div.classList.add("live-cell");
                div.textContent = num;
            }
            div.setAttribute("data-idx", idx);
            const idxLabel = document.createElement("div");
            idxLabel.classList.add("array-index");
            idxLabel.textContent = idx;
            div.appendChild(idxLabel);
            arrayView.appendChild(div);
        });

        if (tooMany) {
            const warningBox = document.createElement("div");
            warningBox.classList.add("array-cell", "warning-cell");
            warningBox.innerHTML = `<span style="color: var(--error); font-size: 0.75rem;" title="Input limited to 10 numbers for visualization">...</span><div class="array-index">${numbers.length}</div>`;
            arrayView.appendChild(warningBox);
        }
    }
    requestAnimationFrame(handleArrayLayout); // Update layout
}

// Render array visualization based on step data
function renderArray(step, animate = true, onSwapDone = null) {
    arrayView.innerHTML = "";
    if (!step || !step.a || !Array.isArray(step.a) || step.a.length === 0) {
        if (typeof onSwapDone === "function") setTimeout(onSwapDone, 0);
        return;
    }

    let displayArray = step.a.slice();
    let isAnimatedSwapStep = animate && step.swap && step.swap.length === 2 && step.animateSwapStep && stepMode === 'compact'; // Animate only in compact mode

    // Determine the array state *before* the animation starts (only for compact mode animation)
    if (isAnimatedSwapStep) {
        let lookBackIndex = currentStep - 1;
        let actualPrevStep = null;
        while (lookBackIndex >= 0) {
            actualPrevStep = steps[lookBackIndex];
            // Stop if we find the 'comparing' step for the same i,j in compact mode
            if (actualPrevStep && actualPrevStep.i === step.i && actualPrevStep.j === step.j && actualPrevStep.type === 'comparing') {
                break;
            }
            if (lookBackIndex < currentStep - 5) { // Safety break
                actualPrevStep = null; break;
            }
            lookBackIndex--;
        }
        if (actualPrevStep && actualPrevStep.a) displayArray = actualPrevStep.a.slice();
        else isAnimatedSwapStep = false; // Fallback: Render target state, skip animation
    }

    // Create array cells
    displayArray.forEach((val, idx) => {
        const div = document.createElement("div");
        div.classList.add("array-cell");
        const sortedIndices = Array.isArray(step.sorted) ? step.sorted : [];
        const compareIndices = Array.isArray(step.compare) ? step.compare : [];
        const swapIndices = Array.isArray(step.swap) ? step.swap : [];

        if (step.passComplete && sortedIndices[idx]) div.classList.add("pass-complete");
        else if (sortedIndices[idx]) div.classList.add("sorted");
        if (compareIndices.includes(idx)) div.classList.add("compare");
        if (swapIndices.includes(idx) && isAnimatedSwapStep) div.classList.add("swap"); // Class for animation trigger

        div.textContent = val;
        div.setAttribute("data-idx", String(idx));
        const idxLabel = document.createElement("div");
        idxLabel.classList.add("array-index");
        idxLabel.textContent = idx;
        div.appendChild(idxLabel);
        arrayView.appendChild(div);
    });

    requestAnimationFrame(handleArrayLayout); // Update layout

    // Trigger animation if needed (only in compact mode)
    if (isAnimatedSwapStep) {
        isSwapping = true;
        animateSwap(step.swap[0], step.swap[1], () => {
            isSwapping = false;
            renderArray(step, false); // Re-render final state without animation
            if (typeof onSwapDone === "function") setTimeout(onSwapDone, 0);
        });
    } else {
        // Re-render final state if mismatch detected (safety check)
        let displayedValues = Array.from(arrayView.querySelectorAll('.array-cell:not(.warning-cell)'))
            .map(cell => Number(cell.childNodes[0]?.textContent?.trim() || NaN))
            .filter(v => !isNaN(v));
        if (JSON.stringify(displayedValues) !== JSON.stringify(step.a)) {
            console.log("Post-render mismatch, re-rendering final step state.");
            renderArray(step, false);
        }
        if (typeof onSwapDone === "function") setTimeout(onSwapDone, 0);
    }
}


// 3-Stage Swap animation
function animateSwap(i, j, onSwapDone) {
    const indexI = Number(i);
    const indexJ = Number(j);
    const cells = arrayView.querySelectorAll(".array-cell");
    const cellA = Array.from(cells).find(cell => cell.getAttribute("data-idx") === String(indexI));
    const cellB = Array.from(cells).find(cell => cell.getAttribute("data-idx") === String(indexJ));

    if (!cellA || !cellB) {
        if (onSwapDone) setTimeout(onSwapDone, 0); return;
    }

    const rectA = cellA.getBoundingClientRect();
    const rectB = cellB.getBoundingClientRect();
    const containerRect = arrayView.getBoundingClientRect();
    const deltaX = (rectB.left - containerRect.left) - (rectA.left - containerRect.left);
    const liftY = -30; // Reduced lift

    cellA.style.position = "relative"; cellB.style.position = "relative";
    cellA.style.zIndex = "100"; cellB.style.zIndex = "90";

    // Stage 1: Lift
    cellA.style.transition = "transform 0.15s ease-out"; cellB.style.transition = "transform 0.15s ease-out";
    cellA.style.transform = `translateY(${liftY}px)`; cellB.style.transform = `translateY(${liftY}px)`;

    setTimeout(() => {
        // Stage 2: Slide
        cellA.style.transition = "transform 0.3s ease-in-out"; cellB.style.transition = "transform 0.3s ease-in-out";
        cellA.style.transform = `translateX(${deltaX}px) translateY(${liftY}px)`;
        cellB.style.transform = `translateX(${-deltaX}px) translateY(${liftY}px)`;

        setTimeout(() => {
            // Stage 3: Settle
            cellA.style.transition = "transform 0.2s ease-in"; cellB.style.transition = "transform 0.2s ease-in";
            cellA.style.transform = `translateX(${deltaX}px) translateY(0)`;
            cellB.style.transform = `translateX(${-deltaX}px) translateY(0)`;

            setTimeout(() => {
                // Cleanup
                cellA.style.transition = ""; cellB.style.transition = "";
                cellA.style.transform = ""; cellB.style.transform = "";
                cellA.style.position = ""; cellB.style.position = "";
                cellA.style.zIndex = ""; cellB.style.zIndex = "";
                if (onSwapDone) setTimeout(onSwapDone, 0);
            }, 200); // Wait settle
        }, 300); // Wait slide
    }, 150); // Wait lift
}

// --- Render UI Elements ---
function renderVariableState(step) {
    if (!variableState) return;
    variableState.innerHTML = "";
    if (!step) { variableState.innerHTML = "Initializing..."; return; }
    const parts = [];
    if (step.i !== null && step.i !== undefined) parts.push(`<b>i (pass)</b> = ${step.i}`);
    if (step.j !== null && step.j !== undefined) parts.push(`<b>j (index)</b> = ${step.j}`);

    if (step.done) variableState.innerHTML = `<b>Sorting Completed</b>`;
    else if (parts.length > 0) variableState.innerHTML = parts.join("&nbsp;&nbsp;|&nbsp;&nbsp;");
    else variableState.innerHTML = "Processing...";
}

function renderStepDesc(step) {
    if (!stepDesc) return;
    stepDesc.innerHTML = step ? step.desc : "<p>Enter an array and click Start.</p>";
    stepDesc.scrollTop = 0; // Scroll to top on new description
}

function renderComplexities() {
    if (timeComplexitySpan) timeComplexitySpan.textContent = "Best: O(n), Avg/Worst: O(n²)";
    if (spaceComplexitySpan) spaceComplexitySpan.textContent = "O(1)";
}

function renderResult(step) {
    if (!resultSpan) return;
    const shouldShow = step?.done;
    resultSpan.classList.toggle('show', shouldShow); // Use class for opacity transition

    if (shouldShow) {
        resultSpan.textContent = "🎉 Sorting Completed!";
        if (variableState) variableState.innerHTML = `<b>Sorting Completed</b>`;

        if (!progressSentForThisView) {
            console.log('Visualization complete or terminated, sending viewing time.');
            sendVisualizationProgressUpdate();
        }
    } else {
        // Clear text immediately if not shown
        resultSpan.textContent = "";
    }
}

function highlightCodeLines(lines) {
    if (!codeBlock) return;
    const linesToHighlight = Array.isArray(lines) ? lines : [];
    codeBlock.innerHTML = bubbleSortCodeLines.map((line, idx) => {
        if (idx > 0 && linesToHighlight.includes(idx)) {
            return `<span class="highlight">${line}</span>`;
        }
        return line;
    }).join("\n");
}
// --- End Render UI ---

// --- Main Rendering Orchestrator ---
function renderCurrentStep(manual = false) {
    if (!steps || steps.length === 0) {
        updateButtonState(); return;
    }
    if (currentStep < 0 || currentStep >= steps.length) {
        if (isPlaying) pauseAutoplay();
        currentStep = Math.max(0, Math.min(steps.length - 1, currentStep));
    }

    const step = steps[currentStep];
    if (!step) {
        if (isPlaying) pauseAutoplay();
        updateButtonState(); return;
    }

    let needsAnimation = step.animateSwapStep && isPlaying && stepMode === 'compact' && !manual;

    const afterRenderOrAnimation = () => {
        renderVariableState(step);
        renderStepDesc(step);
        highlightCodeLines(step.codeLines);
        renderResult(step);
        updateButtonState();

        if (isPlaying && !isSwapping) {
            if (currentStep < steps.length - 1 && !step.done) {
                let delay = step.passComplete ? Math.max(1000, autoplayDelay * 1.5) : autoplayDelay; // Adjusted pass complete delay
                if (needsAnimation) delay = Math.max(50, autoplayDelay / 3); // Shorter delay after compact animation

                if (autoplayTimer) clearTimeout(autoplayTimer);
                autoplayTimer = setTimeout(() => {
                    if (!isPlaying) return;
                    currentStep++;
                    autoplayNext();
                }, delay);
            } else {
                isPlaying = false;
                if (!step.done && steps.length > 0) renderResult(steps[steps.length - 1]);
                else renderResult(step);
                updateButtonState();
            }
        }
    };

    if (needsAnimation) {
        isSwapping = true;
        renderArray(step, true, () => {
            isSwapping = false;
            afterRenderOrAnimation();
        });
    } else {
        renderArray(step, false, afterRenderOrAnimation);
    }
}

function updateButtonState() {
    if (!prevBtn || !nextBtn || !pausePlayBtn) return;
    pausePlayBtn.innerHTML = `<span>${isPlaying ? "⏸ Pause" : "▶ Play"}</span>`;

    const noSteps = !steps || steps.length === 0;
    const isAtStart = currentStep <= 0;
    const isEffectivelyAtEnd = noSteps || currentStep >= steps.length - 1 || (steps[currentStep] && steps[currentStep].done);

    prevBtn.disabled = noSteps || isPlaying || isSwapping || isAtStart;
    nextBtn.disabled = noSteps || isPlaying || isSwapping || isEffectivelyAtEnd;
    pausePlayBtn.disabled = noSteps || isSwapping || isEffectivelyAtEnd;

    // Additional check: disable play if paused exactly on the last/done step
    if (!isPlaying && isEffectivelyAtEnd) pausePlayBtn.disabled = true;
}

// --- Autoplay Functions ---
function startAutoplay() {
    const isAtEnd = !steps || steps.length === 0 || currentStep >= steps.length - 1 || (steps[currentStep] && steps[currentStep].done);
    if (isPlaying || isAtEnd) { updateButtonState(); return; }

    isPlaying = true;
    if (stepMode === "detailed") {
        const newStepIndex = findCorrespondingStep(detailedSteps, compactSteps, currentStep);
        stepMode = "compact"; steps = compactSteps; currentStep = newStepIndex;
    }
    if (!startTime && currentStep > 0) startTimer();
    updateButtonState();
    autoplayNext();
}

function autoplayNext() {
    if (!isPlaying) return;
    const isAtEnd = !steps || steps.length === 0 || currentStep >= steps.length || (steps[currentStep] && steps[currentStep].done);
    if (isAtEnd) {
        isPlaying = false;
        if (currentStep >= steps.length && steps.length > 0) currentStep = steps.length - 1;
        if (steps[currentStep]) renderCurrentStep(false);
        updateButtonState(); return;
    }
    renderCurrentStep(false);
}

function pauseAutoplay() {
    if (!isPlaying) return;
    if (autoplayTimer) { clearTimeout(autoplayTimer); autoplayTimer = null; }
    isPlaying = false; isSwapping = false;

    if (stepMode === "compact") {
        const newStepIndex = findCorrespondingStep(compactSteps, detailedSteps, currentStep);
        stepMode = "detailed"; steps = detailedSteps; currentStep = newStepIndex;
        renderCurrentStep(true); // Render mapped detailed step
    } else {
        renderCurrentStep(true); // Re-render current detailed step
    }
    updateButtonState();
}

// --- Controls ---
function startVisualization() {
    const raw = arrayInput.value.trim();
    let inputNumbers = raw.length === 0 ? [] : raw.split(",").map(s => s.trim()).filter(s => s.length > 0);

    if (inputNumbers.length === 0) { alert("Please enter at least one number."); return; }
    if (inputNumbers.length > 10) {
        alert("Visualizing only the first 10 numbers.");
        inputNumbers = inputNumbers.slice(0, 10);
        arrayInput.value = inputNumbers.join(', ');
        createLiveArrayVisualization();
    }
    array = inputNumbers.map(Number);
    if (array.some(isNaN)) { alert("Please enter only valid numbers."); return; }

    stopTimer(); elapsedTime = 0; progressSentForThisView = false;
    startTimer();

    const order = orderSelect.value === "desc" ? "desc" : "asc";
    if (isPlaying) pauseAutoplay();
    if (autoplayTimer) { clearTimeout(autoplayTimer); autoplayTimer = null; }

    const generated = prepareBubbleSortSteps(array, order);
    detailedSteps = generated.detailedSteps; compactSteps = generated.compactSteps;
    stepMode = "detailed"; steps = detailedSteps;
    currentStep = 0; isPlaying = false; isSwapping = false;

    renderCurrentStep(true);
    renderComplexities();
    updateButtonState();
}

// --- Event Listeners ---
arrayInput.addEventListener("input", () => {
    if (isPlaying || startTime || currentStep > 0) {
        if (isPlaying) pauseAutoplay();
        stopTimer(); elapsedTime = 0; progressSentForThisView = false;
        steps = []; detailedSteps = []; compactSteps = []; currentStep = 0;
        highlightCodeLines([]); renderVariableState(null); renderStepDesc(null);
        renderResult(null); updateButtonState();
    }
    createLiveArrayVisualization();
});

startBtn.onclick = () => { progressSentForThisView = false; startVisualization(); };
pausePlayBtn.onclick = () => { if (!steps || steps.length === 0) return; if (isPlaying) pauseAutoplay(); else { const isAtEnd = currentStep >= steps.length - 1 || (steps[currentStep] && steps[currentStep].done); if (!startTime && !isAtEnd) startTimer(); autoplayDelay = calcAutoplayDelay(parseInt(speedSlider.value, 10)); startAutoplay(); } };
nextBtn.onclick = () => { const isAtEnd = !steps || steps.length === 0 || currentStep >= steps.length - 1 || (steps[currentStep] && steps[currentStep].done); if (isSwapping || isPlaying || isAtEnd) return; if (!startTime && currentStep === 0) startTimer(); if (stepMode === "compact") { const newStepIndex = findCorrespondingStep(compactSteps, detailedSteps, currentStep); stepMode = "detailed"; steps = detailedSteps; currentStep = newStepIndex; renderCurrentStep(true); return; } currentStep++; renderCurrentStep(true); };
prevBtn.onclick = () => { if (isSwapping || isPlaying || currentStep <= 0) return; if (stepMode === "compact") { const newStepIndex = findCorrespondingStep(compactSteps, detailedSteps, currentStep); stepMode = "detailed"; steps = detailedSteps; currentStep = newStepIndex; } if (currentStep > 0) currentStep--; renderCurrentStep(true); };

speedSlider.oninput = () => {
    autoplayDelay = calcAutoplayDelay(parseInt(speedSlider.value, 10));
    speedValue.textContent = `${speedSlider.value}`;
    if (isPlaying && autoplayTimer) {
        clearTimeout(autoplayTimer);
        autoplayTimer = setTimeout(() => { if (!isPlaying) return; autoplayNext(); }, autoplayDelay);
    }
};

arrayInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); progressSentForThisView = false; startVisualization(); } });

// Scroll listener for array container
const arrayContainer = document.querySelector('.array-container');
if (arrayContainer) {
    arrayContainer.addEventListener('scroll', handleArrayLayout);
}

// --- Chart Generation ---
// (Included from previous response)
let myComplexityChart = null; // Store chart instance globally

function createComplexityChart() {
    const ctx = document.getElementById('complexityChart');
    if (!ctx) { console.error("Canvas element for chart not found!"); return; }
    if (myComplexityChart) { myComplexityChart.destroy(); } // Destroy previous chart if exists

    const labels = []; const dataPoints = [];
    const maxN = 25; const step = Math.max(1, Math.floor(maxN / 10));
    for (let n = 0; n <= maxN; n += step) { labels.push(n); dataPoints.push(n * n); }
    if (labels[labels.length - 1] < maxN) { labels.push(maxN); dataPoints.push(maxN * maxN); }

    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
    const gridColor = isDarkMode ? 'rgba(100, 116, 139, 0.2)' : 'rgba(203, 213, 225, 0.5)';
    const labelColor = isDarkMode ? '#cbd5e1' : '#475569';
    const pointColor = isDarkMode ? '#60a5fa' : '#3b82f6';

    myComplexityChart = new Chart(ctx, { // Assign to global variable
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Operations (Approx. n²)', data: dataPoints, borderColor: pointColor, backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.1, pointRadius: 3, pointBackgroundColor: pointColor, fill: true, }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => `~${ctx.parsed.y} ops for n=${ctx.parsed.x}` } },
                title: { display: true, text: 'Time Complexity Growth (O(n²))', color: labelColor, font: { size: 14, weight: 'bold', family: 'Inter, sans-serif' }, padding: { top: 0, bottom: 10 } }
            },
            scales: {
                x: { title: { display: true, text: 'Input Size (n)', color: labelColor, font: { family: 'Inter, sans-serif' } }, grid: { color: gridColor }, ticks: { color: labelColor, font: { family: 'Inter, sans-serif' } } },
                y: { title: { display: true, text: 'Operations', color: labelColor, font: { family: 'Inter, sans-serif' } }, beginAtZero: true, grid: { color: gridColor }, ticks: { color: labelColor, font: { family: 'Inter, sans-serif' } } }
            }
        }
    });
    window.myComplexityChart = myComplexityChart; // Assign to window for theme manager access
}

// Function to update chart theme
function updateChartTheme(chart) {
    if (!chart) return;
    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
    const gridColor = isDarkMode ? 'rgba(100, 116, 139, 0.2)' : 'rgba(203, 213, 225, 0.5)';
    const labelColor = isDarkMode ? '#cbd5e1' : '#475569';
    const pointColor = isDarkMode ? '#60a5fa' : '#3b82f6';

    // Update colors
    chart.options.plugins.title.color = labelColor;
    chart.options.scales.x.title.color = labelColor;
    chart.options.scales.x.grid.color = gridColor;
    chart.options.scales.x.ticks.color = labelColor;
    chart.options.scales.y.title.color = labelColor;
    chart.options.scales.y.grid.color = gridColor;
    chart.options.scales.y.ticks.color = labelColor;
    chart.data.datasets[0].borderColor = pointColor;
    chart.data.datasets[0].pointBackgroundColor = pointColor;
    // Update background color slightly for dark mode
    chart.data.datasets[0].backgroundColor = isDarkMode ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.1)';


    chart.update();
}
// --- End Chart Generation ---

// --- Space Complexity Chart ---
let mySpaceComplexityChart = null; // Store chart instance globally

function createSpaceComplexityChart() {
    const ctx = document.getElementById('spaceComplexityChart');
    if (!ctx) { console.error("Canvas element for space chart not found!"); return; }
    if (mySpaceComplexityChart) { mySpaceComplexityChart.destroy(); } // Destroy previous chart if exists

    const labels = [];
    const dataPoints = [];
    const maxN = 25; // Match the N range of the time complexity chart
    const step = Math.max(1, Math.floor(maxN / 10));

    // For O(1), the value is constant (e.g., 1 unit of space) regardless of N
    for (let n = 0; n <= maxN; n += step) {
        labels.push(n);
        dataPoints.push(1); // Constant value
    }
    // Ensure the last point is included if step doesn't divide evenly
    if (labels[labels.length - 1] < maxN) {
        labels.push(maxN);
        dataPoints.push(1);
    }


    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
    const gridColor = isDarkMode ? 'rgba(100, 116, 139, 0.2)' : 'rgba(203, 213, 225, 0.5)';
    const labelColor = isDarkMode ? '#cbd5e1' : '#475569';
    // Use a different color for space complexity, e.g., green
    const pointColor = isDarkMode ? '#34d399' : '#10b981'; // Green
    const bgColor = isDarkMode ? 'rgba(52, 211, 153, 0.1)' : 'rgba(16, 185, 129, 0.1)';


    mySpaceComplexityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Space Units (Approx. 1)',
                data: dataPoints,
                borderColor: pointColor,
                backgroundColor: bgColor,
                tension: 0, // Straight line for O(1)
                pointRadius: 3,
                pointBackgroundColor: pointColor,
                fill: true,
                stepped: true // Optional: Makes it look more constant
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `~${ctx.parsed.y} space unit(s) for n=${ctx.parsed.x}`
                    }
                },
                title: {
                    display: true,
                    text: 'Space Complexity Growth (O(1))',
                    color: labelColor,
                    font: { size: 14, weight: 'bold', family: 'Inter, sans-serif' },
                    padding: { top: 0, bottom: 10 }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Input Size (n)', color: labelColor, font: { family: 'Inter, sans-serif' } },
                    grid: { color: gridColor },
                    ticks: { color: labelColor, font: { family: 'Inter, sans-serif' } }
                },
                y: {
                    title: { display: true, text: 'Space Units', color: labelColor, font: { family: 'Inter, sans-serif' } },
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: {
                        color: labelColor,
                        font: { family: 'Inter, sans-serif' },
                        // Set max ticks to show 0 and 1 clearly, maybe a bit more
                        maxTicksLimit: 3,
                        stepSize: 1
                    },
                    // Set a max value slightly above 1 so the line is visible
                     max: 2
                }
            }
        }
    });
    window.mySpaceComplexityChart = mySpaceComplexityChart; // Assign to window if needed for theme updates
}

// Function to update space complexity chart theme (similar to time complexity one)
function updateSpaceChartTheme(chart) {
    if (!chart) return;
    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
    const gridColor = isDarkMode ? 'rgba(100, 116, 139, 0.2)' : 'rgba(203, 213, 225, 0.5)';
    const labelColor = isDarkMode ? '#cbd5e1' : '#475569';
    // Use the same green colors as defined in createSpaceComplexityChart
    const pointColor = isDarkMode ? '#34d399' : '#10b981';
    const bgColor = isDarkMode ? 'rgba(52, 211, 153, 0.1)' : 'rgba(16, 185, 129, 0.1)';

    // Update colors
    chart.options.plugins.title.color = labelColor;
    chart.options.scales.x.title.color = labelColor;
    chart.options.scales.x.grid.color = gridColor;
    chart.options.scales.x.ticks.color = labelColor;
    chart.options.scales.y.title.color = labelColor;
    chart.options.scales.y.grid.color = gridColor;
    chart.options.scales.y.ticks.color = labelColor;
    chart.data.datasets[0].borderColor = pointColor;
    chart.data.datasets[0].pointBackgroundColor = pointColor;
    chart.data.datasets[0].backgroundColor = bgColor;

    chart.update();
}

// --- Code Snippet Tab Switching and Copy ---
// (Included from previous response)
function setupCodeSnippets() {
    const tabs = document.querySelectorAll('.code-tab');
    const snippets = document.querySelectorAll('.code-snippet');
    const copyBtn = document.getElementById('copyCodeBtn');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const lang = tab.getAttribute('data-lang');

            // Deactivate all tabs and snippets
            tabs.forEach(t => t.classList.remove('active'));
            snippets.forEach(s => s.classList.remove('active'));

            // Activate the clicked tab and corresponding snippet
            tab.classList.add('active');
            const activeSnippet = document.getElementById(`code-snippet-${lang}`);
            if (activeSnippet) {
                activeSnippet.classList.add('active');
            }
        });
    });

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const activeSnippet = document.querySelector('.code-snippet.active code');
            if (activeSnippet) {
                navigator.clipboard.writeText(activeSnippet.textContent)
                    .then(() => {
                        // Optional: Show temporary success message
                        const originalIcon = copyBtn.innerHTML;
                        copyBtn.innerHTML = '<i class="fas fa-check text-green-500"></i>';
                        copyBtn.title = "Copied!";
                        setTimeout(() => {
                            copyBtn.innerHTML = originalIcon;
                            copyBtn.title = "Copy Code";
                        }, 1500);
                    })
                    .catch(err => {
                        console.error('Failed to copy code: ', err);
                        alert('Failed to copy code.'); // Fallback alert
                    });
            }
        });
    }
}
// --- End Code Snippet ---

// --- Initialize Page Content (Wrap existing DOMContentLoaded logic) ---
function initializePageContent() {
    console.log("Initializing Bubble Sort Visualization page content...");

    const themeManager = new ThemeManager(); // Theme manager initialized here
    progressSentForThisView = false;
    createLiveArrayVisualization();
    renderVariableState(null); renderStepDesc(null); resultSpan.textContent = ""; highlightCodeLines([]);
    renderComplexities(); updateButtonState();

    createComplexityChart(); // Create time complexity chart
    createSpaceComplexityChart(); // Create space complexity chart
    setupCodeSnippets(); // Setup code tabs and copy button

    // Setup Event Listeners (move listeners inside this function)
    arrayInput.addEventListener("input", () => {
        if (isPlaying || startTime || currentStep > 0) {
            if (isPlaying) pauseAutoplay();
            stopTimer(); elapsedTime = 0; progressSentForThisView = false;
            steps = []; detailedSteps = []; compactSteps = []; currentStep = 0;
            highlightCodeLines([]); renderVariableState(null); renderStepDesc(null);
            renderResult(null); updateButtonState();
        }
        createLiveArrayVisualization();
    });

    startBtn.onclick = () => { progressSentForThisView = false; startVisualization(); };
    pausePlayBtn.onclick = () => { if (!steps || steps.length === 0) return; if (isPlaying) pauseAutoplay(); else { const isAtEnd = currentStep >= steps.length - 1 || (steps[currentStep] && steps[currentStep].done); if (!startTime && !isAtEnd) startTimer(); autoplayDelay = calcAutoplayDelay(parseInt(speedSlider.value, 10)); startAutoplay(); } };
    nextBtn.onclick = () => { const isAtEnd = !steps || steps.length === 0 || currentStep >= steps.length - 1 || (steps[currentStep] && steps[currentStep].done); if (isSwapping || isPlaying || isAtEnd) return; if (!startTime && currentStep === 0) startTimer(); if (stepMode === "compact") { const newStepIndex = findCorrespondingStep(compactSteps, detailedSteps, currentStep); stepMode = "detailed"; steps = detailedSteps; currentStep = newStepIndex; renderCurrentStep(true); return; } currentStep++; renderCurrentStep(true); };
    prevBtn.onclick = () => { if (isSwapping || isPlaying || currentStep <= 0) return; if (stepMode === "compact") { const newStepIndex = findCorrespondingStep(compactSteps, detailedSteps, currentStep); stepMode = "detailed"; steps = detailedSteps; currentStep = newStepIndex; } if (currentStep > 0) currentStep--; renderCurrentStep(true); };

    speedSlider.oninput = () => {
        autoplayDelay = calcAutoplayDelay(parseInt(speedSlider.value, 10));
        speedValue.textContent = `${speedSlider.value}`;
        if (isPlaying && autoplayTimer) {
            clearTimeout(autoplayTimer);
            autoplayTimer = setTimeout(() => { if (!isPlaying) return; autoplayNext(); }, autoplayDelay);
        }
    };

    arrayInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); progressSentForThisView = false; startVisualization(); } });

    const arrayContainer = document.querySelector('.array-container');
    if (arrayContainer) {
        arrayContainer.addEventListener('scroll', handleArrayLayout);
    }

    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    } else {
        console.error("Logout button not found!");
    }

    const quizButton = document.getElementById('quiz-button');
    if (quizButton) {
        quizButton.addEventListener('click', quiz_btn); // Assuming quiz_btn function exists
    }


    // Ripple effect (assuming it's safe to run multiple times, or move it inside too)
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', function (e) { if (this.disabled) return; const ripple = document.createElement('span'); const rect = this.getBoundingClientRect(); const size = Math.max(rect.width, rect.height) * 1.5; const x = e.clientX - rect.left - size / 2; const y = e.clientY - rect.top - size / 2; ripple.style.width = ripple.style.height = size + 'px'; ripple.style.left = x + 'px'; ripple.style.top = y + 'px'; ripple.classList.add('ripple'); this.appendChild(ripple); setTimeout(() => { if (ripple.parentNode) ripple.remove(); }, 600); });
    });

    // Initial check for scrollbars
    handleArrayLayout();

    // Send data on visibility change or unload (move these inside as well)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { stopTimer(); if (!progressSentForThisView && elapsedTime >= 5) { if (navigator.sendBeacon) sendVisualizationProgressBeacon(); else sendVisualizationProgressUpdate(); } } });
    window.addEventListener('pagehide', (event) => { if (!event.persisted) { stopTimer(); if (!progressSentForThisView && elapsedTime >= 5) { if (navigator.sendBeacon) sendVisualizationProgressBeacon(); } } });

    console.log("Bubble Sort Visualization page fully initialized after access check.");
}

// --- Navigation to Practice Quiz ---
function quiz_btn() {
    console.log("Navigating to practice quiz...");
    stopTimer();
    if (!progressSentForThisView && elapsedTime >= 5) {
        if (navigator.sendBeacon) sendVisualizationProgressBeacon();
        else sendVisualizationProgressUpdate();
    }
    window.location.href = "practice_logic.html";
}


// --- Progress Update Logic ---
async function sendVisualizationProgressUpdate() {
    const token = localStorage.getItem('authToken');
    if (!token || progressSentForThisView) return;

    const timeSpentSeconds = elapsedTime;
    if (timeSpentSeconds < 5) { elapsedTime = 0; startTime = null; return; }

    const progressData = { category: 'sorting', algorithm: 'bubbleSort', data: { timeSpentViz: timeSpentSeconds, lastAttemptViz: new Date() } };
    console.log('Sending visualization progress update via Fetch:', progressData);
    progressSentForThisView = true;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/progress`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(progressData), keepalive: true });
        if (!response.ok) { let errorMsg = `HTTP error ${response.status}`; try { const result = await response.json(); errorMsg = result.message || errorMsg; } catch (e) { } throw new Error(errorMsg); }
        const result = await response.json(); console.log('Visualization progress update successful (Fetch):', result);
        elapsedTime = 0; startTime = null; // Reset only on success
    } catch (error) { progressSentForThisView = false; console.error('Error sending visualization progress update (Fetch):', error); }
}

function sendVisualizationProgressBeacon() {
    const token = localStorage.getItem('authToken');
    if (!token || progressSentForThisView) return false;
    const timeSpentSeconds = elapsedTime;
    if (timeSpentSeconds < 5) return false;

    const progressData = { category: 'sorting', algorithm: 'bubbleSort', data: { timeSpentViz: timeSpentSeconds, lastAttemptViz: new Date() } };
    console.log('Sending visualization progress update via Beacon:', progressData);
    progressSentForThisView = true;
    const blob = new Blob([JSON.stringify(progressData)], { type: 'application/json' });
    const beaconURL = `${API_BASE_URL}/auth/progress?authToken=${encodeURIComponent(token)}`; // Consider security implications

    try {
        const success = navigator.sendBeacon(beaconURL, blob);
        if (success) { elapsedTime = 0; startTime = null; return true; }
        else { progressSentForThisView = false; return false; }
    } catch (error) { progressSentForThisView = false; console.error('Error calling navigator.sendBeacon:', error); return false; }
}

// Send data on visibility change or unload
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { stopTimer(); if (!progressSentForThisView && elapsedTime >= 5) { if (navigator.sendBeacon) sendVisualizationProgressBeacon(); else sendVisualizationProgressUpdate(); } } });

window.addEventListener('pagehide', (event) => { if (!event.persisted) { stopTimer(); if (!progressSentForThisView && elapsedTime >= 5) { if (navigator.sendBeacon) sendVisualizationProgressBeacon(); } } });
