// index.js (for Selection Sort)

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
            console.log('Access granted to selectionSort.');
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
        window.location.href = '../../auth.html';
    }
}

// Selection sort source code lines (for code highlighting)
const selectionSortCodeLines = [
    "", // Line 0 (empty)
    "function selectionSort(arr) {", // Line 1
    "  const n = arr.length;", // Line 2
    "  for (let i = 0; i < n - 1; i++) {", // Line 3 (Outer loop start)
    "    let minIndex = i;", // Line 4 (Initialize minIndex)
    "    for (let j = i + 1; j < n; j++) {", // Line 5 (Inner loop start)
    "      if (arr[j] < arr[minIndex]) {", // Line 6 (Comparison)
    "        minIndex = j;", // Line 7 (Update minIndex)
    "      }", // Line 8 (End if)
    "    }", // Line 9 (End inner loop)
    "    if (minIndex !== i) {", // Line 10 (Check if swap needed)
    "      // Swap arr[i] and arr[minIndex]", // Line 11 (Comment)
    "      let temp = arr[i];", // Line 12 (Swap step 1)
    "      arr[i] = arr[minIndex];", // Line 13 (Swap step 2)
    "      arr[minIndex] = temp;", // Line 14 (Swap step 3)
    "    }", // Line 15 (End if swap needed)
    "  }", // Line 16 (End outer loop)
    "  return arr;", // Line 17
    "}" // Line 18
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
let steps = [];   // current steps (detailed or compact)
let currentStep = 0;
let autoplayTimer = null;
let isPlaying = false;
let stepMode = "detailed";
let isSwapping = false; // lock UI during animation

// Timer variables
let startTime = null;
let elapsedTime = 0; // in seconds
let intervalId = null;
let progressSentForThisView = false; // Flag to prevent multiple sends

// Map speed slider (1-100) to delay ms
function calcAutoplayDelay(val) {
    return Math.round(2050 - 2000 * (val - 1) / 99);
}
let autoplayDelay = calcAutoplayDelay(parseInt(speedSlider.value, 10));
speedValue.textContent = `${speedSlider.value}`;

// --- Timer Functions ---
function startTimer() {
    if (startTime) return;
    startTime = Date.now();
    elapsedTime = 0;
    if (intervalId) clearInterval(intervalId);
    console.log("Timer started.");
    intervalId = setInterval(() => {
        if (startTime) {
            elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        } else {
            clearInterval(intervalId);
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
        elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        startTime = null;
        console.log(`Final elapsed time recorded: ${elapsedTime}s`);
    }
    return elapsedTime;
}
// --- End Timer Functions ---

// --- Theme Management ---
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.init();
    }
    init() {
        this.applyTheme();
        this.setupToggle();
    }
    applyTheme() {
        document.body.setAttribute('data-theme', this.theme);
        this.updateToggleIcon();
        if (window.myComplexityChart) updateChartTheme(window.myComplexityChart);
        if (window.mySpaceComplexityChart) updateSpaceChartTheme(window.mySpaceComplexityChart);
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
    // Add scroll indicators if needed (similar to Bubble Sort CSS)
}

function findCorrespondingStep(fromSteps, toSteps, currentIdx) {
     if (!fromSteps || !toSteps || fromSteps.length === 0 || toSteps.length === 0) return 0;
     if (currentIdx >= fromSteps.length) return Math.max(0, toSteps.length - 1);
     if (currentIdx < 0) return 0;

     const currentStepData = fromSteps[currentIdx];
     if (!currentStepData) return Math.floor(currentIdx / (fromSteps.length || 1) * toSteps.length);

     // Try precise matching first (type, i, j, minIndex)
     let bestMatch = -1;
     for (let idx = 0; idx < toSteps.length; idx++) {
         const targetStep = toSteps[idx];
         if (targetStep.type === currentStepData.type && targetStep.i === currentStepData.i && targetStep.j === currentStepData.j && targetStep.minIndex === currentStepData.minIndex) {
             bestMatch = idx;
             if (currentStepData.type?.includes('start') || currentStepData.type?.includes('compare') || currentStepData.type?.includes('min-init')) {
                 break; // Prioritize these key steps
             }
         }
     }
     if (bestMatch !== -1) return bestMatch;

     // Fallback: Match based on i and j only (less precise for Selection Sort)
     for (let idx = 0; idx < toSteps.length; idx++) {
         const targetStep = toSteps[idx];
         if (targetStep.i === currentStepData.i && targetStep.j === currentStepData.j) {
             return idx;
         }
     }

     // Final Fallback: estimate position
     console.warn(`Could not find step match for index ${currentIdx}, estimating position.`);
     const progress = currentIdx / fromSteps.length;
     return Math.min(toSteps.length - 1, Math.max(0, Math.floor(progress * toSteps.length)));
}
// --- End Helper Functions ---

// --- Step Description Generation ---
function createStepDescription(type, data) {
    const { i, j, a, order, orderText, minIndex, compareFunc, n, oldMinIndex, swapNeeded } = data || {};

    // Basic data checks
    if (!a && ['comparing', 'min-update', 'swapping', 'pass-complete', 'sorting-complete'].includes(type)) return '<p>Error: Array data missing.</p>';
    if (i === undefined && ['pass-start', 'min-init', 'comparing', 'min-update', 'swapping', 'no-swap', 'pass-complete'].includes(type)) return '<p>Error: Outer loop index `i` missing.</p>';
    if (j === undefined && ['comparing', 'min-update'].includes(type)) return '<p>Error: Inner loop index `j` missing.</p>';
    if (minIndex === undefined && ['min-init', 'comparing', 'min-update', 'swapping', 'no-swap'].includes(type)) return '<p>Error: `minIndex` missing.</p>';

    switch (type) {
        case 'start':
            return `<div class="step-header"><span class="step-icon">🏁</span> <h4 class="step-title">Start Selection Sort</h4></div><div class="step-section"><div class="section-content">Beginning the sorting process.</div></div>`;
        case 'init': // Line 2
            return `<div class="step-header"><span class="step-icon">🔢</span> <h4 class="step-title">Initialize Length</h4></div><div class="step-section"><div class="section-label">Line 2</div><div class="section-content">Set variable n = ${n ?? '?'} (length of the array).</div></div>`;
        case 'pass-start': // Line 3
            return `
            <div class="step-header"><span class="step-icon">🔄</span> <h4 class="step-title">Pass ${i + 1} Started</h4></div>
            <div class="step-section"><div class="section-label">Line 3</div><div class="section-content">Starting outer loop (pass) with i = ${i}.</div></div>
            <div class="step-section"><div class="section-label">Objective</div><div class="section-content">Find the ${order === "asc" ? "smallest" : "largest"} element in the unsorted portion (indices ${i} to ${n - 1}) and place it at index ${i}.</div></div>`;
        case 'min-init': // Line 4
            return `
            <div class="step-header"><span class="step-icon">📍</span> <h4 class="step-title">Initialize Minimum Index</h4></div>
            <div class="step-section"><div class="section-label">Line 4</div><div class="section-content">Assume the first element of the unsorted part (arr[${i}] = ${a?.[i] ?? '?'}) is the minimum. Set minIndex = ${i}.</div></div>`;
        case 'inner-loop-start': // Line 5
             return `
             <div class="step-header"><span class="step-icon">🔍</span> <h4 class="step-title">Scan Unsorted Part (j = ${j})</h4></div>
             <div class="step-section"><div class="section-label">Line 5</div><div class="section-content">Starting inner loop to scan from index ${j} to find the actual minimum in the unsorted part.</div></div>`;
        case 'comparing': // Line 6
            if (!compareFunc || a?.[j] === undefined || a?.[minIndex] === undefined) return '<p>Error comparing: Invalid data.</p>';
            const isNewMin = compareFunc(a[j], a[minIndex]);
            return `
            <div class="step-header"><span class="step-icon">⚖️</span> <h4 class="step-title">Comparing Elements</h4></div>
            <div class="step-section"><div class="section-label">Condition (Line 6)</div><div class="section-content">Check if arr[${j}] (${a[j]}) ${order === "asc" ? "<" : ">"} arr[${minIndex}] (${a[minIndex]}).</div></div>
            <div class="step-section"><div class="section-label">Result</div><div class="section-content"><div class="comparison-result ${isNewMin ? 'result-true' : 'result-false'}">${isNewMin ? `✓ Condition is true. Found new ${orderText} element.` : `✗ Condition is false. Current minimum (at index ${minIndex}) remains.`}</div></div></div>`;
        case 'min-update': // Line 7
            return `
            <div class="step-header"><span class="step-icon">🎯</span> <h4 class="step-title">Minimum Index Updated</h4></div>
            <div class="step-section"><div class="section-label">Action (Line 7)</div><div class="section-content">New ${orderText} element found at index ${j} (value ${a?.[j] ?? '?'}). Update minIndex from ${oldMinIndex} to ${j}.</div></div>`;
        case 'end-inner-if': // Line 8
             return `<div class="step-header"><span class="step-icon">➡️</span> <h4 class="step-title">Continue Scan</h4></div><div class="step-section"><div class="section-label">Flow (After Line 8)</div><div class="section-content">Moving to the next inner loop iteration (j = ${j + 1}).</div></div>`;
        case 'inner-loop-complete': // Line 9
            return `
            <div class="step-header"><span class="step-icon">🏁</span> <h4 class="step-title">Scan Complete for Pass ${i + 1}</h4></div>
            <div class="step-section"><div class="section-label">Line 9</div><div class="section-content">Finished scanning the unsorted part. The index of the ${orderText} element is ${minIndex} (value ${a?.[minIndex] ?? '?'}).</div></div>`;
        case 'check-swap': // Line 10
            return `
            <div class="step-header"><span class="step-icon">❓</span> <h4 class="step-title">Check if Swap Needed</h4></div>
            <div class="step-section"><div class="section-label">Condition (Line 10)</div><div class="section-content">Check if minIndex (${minIndex}) is different from i (${i}). Current result: ${swapNeeded ? 'true' : 'false'}.</div></div>`;
        case 'swapping': // Animated Swap (Conceptual Lines 11-14)
             const swapValI = data.preSwapA ?? a?.[minIndex] ?? '?'; // Value at minIndex before swap
             const swapValMin = data.preSwapB ?? a?.[i] ?? '?'; // Value at i before swap
            return `
            <div class="step-header"><span class="step-icon">↔️</span> <h4 class="step-title">Swapping Elements</h4></div>
            <div class="step-section"><div class="section-label">Action (Lines 12-14)</div><div class="section-content">Swapping the ${orderText} element (arr[${minIndex}] = ${swapValI}) with the first element of the unsorted part (arr[${i}] = ${swapValMin}).</div></div>`;
        case 'swap-step': // Detailed Swap Steps
            const { step, stepDesc: swapStepDesc } = data;
            const lineMap = { 1: 12, 2: 13, 3: 14 };
            return `
            <div class="step-header"><span class="step-icon">⚙️</span> <h4 class="step-title">Swap Step ${step} (Line ${lineMap[step]})</h4></div>
            <div class="step-section"><div class="section-label">Process</div><div class="section-content">${swapStepDesc ?? ''}</div></div>`;
        case 'no-swap': // After Line 10 check is false
            return `
            <div class="step-header"><span class="step-icon">✅</span> <h4 class="step-title">No Swap Needed</h4></div>
            <div class="step-section"><div class="section-label">Result (After Line 10)</div><div class="section-content">The ${orderText} element is already at the correct position (index ${i}). No swap required for this pass.</div></div>`;
        case 'pass-complete': // Line 16 (End of outer loop iteration)
             const sortedVal = a?.[i] ?? '?';
            return `
            <div class="pass-complete-display">
              <div class="pass-complete-title">🎯 Pass ${i + 1} Complete! (End of Line 16)</div>
              <div class="pass-complete-details">Element at index ${i} (value ${sortedVal}) is now sorted. Proceeding to next pass (i = ${i + 1}).</div>
            </div>`;
        case 'sorting-complete': // Line 17/18
            const finalSortedArray = Array.isArray(a) ? a.join(", ") : 'Error';
            return `
            <div class="final-result-display">
              <div class="final-result-title">🎉 Sorting Complete! (After Line 18)</div>
              <div class="step-section"><div class="section-label">Result</div><div class="section-content">The array is now fully sorted in ${orderText ?? '?'} order. <div class="final-array-display">[${finalSortedArray}]</div></div></div>
            </div>`;
        default: return `<p>Loading description...</p>`;
    }
}
// --- End Step Description ---

// --- prepareSelectionSortSteps ---
function prepareSelectionSortSteps(arr, order = "asc") {
    let a = arr.slice();
    const n = a.length;
    let detailed = [];
    let compact = [];
    let sortedIndices = Array(n).fill(false);
    const compareFunc = order === "asc" ? (x, y) => x < y : (x, y) => x > y;
    const orderText = order === "asc" ? "smallest" : "largest";

    detailed.push({ type: 'start', a: a.slice(), i: null, j: null, minIndex: null, compare: [], currentMin: [], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('start', {}), codeLines: [1], done: false });
    compact.push(detailed[detailed.length - 1]);

    detailed.push({ type: 'init', a: a.slice(), i: null, j: null, minIndex: null, compare: [], currentMin: [], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('init', { n }), codeLines: [2], done: false });
    compact.push(detailed[detailed.length - 1]);

    for (let i = 0; i < n - 1; i++) {
        detailed.push({ type: 'pass-start', a: a.slice(), i, j: null, minIndex: null, compare: [], currentMin: [], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('pass-start', { i, a: a.slice(), order, n }), codeLines: [3], done: false });
        compact.push(detailed[detailed.length - 1]);

        let minIndex = i;
        detailed.push({ type: 'min-init', a: a.slice(), i, j: null, minIndex, compare: [], currentMin: [minIndex], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('min-init', { i, a: a.slice(), minIndex }), codeLines: [4], done: false });
        compact.push(detailed[detailed.length - 1]);

        for (let j = i + 1; j < n; j++) {
             detailed.push({ type: 'inner-loop-start', a: a.slice(), i, j, minIndex, compare: [], currentMin: [minIndex], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('inner-loop-start', { i, j }), codeLines: [5], done: false });
            // Don't add inner-loop-start to compact

            const preCompareState = a.slice();
            const currentMinVal = preCompareState[minIndex]; // Store min value before potential update
            const isNewMin = compareFunc(a[j], currentMinVal);
            const comparingDesc = createStepDescription('comparing', { i, j, a: preCompareState, order, orderText, minIndex, compareFunc });

            detailed.push({ type: 'comparing', a: preCompareState, i, j, minIndex, compare: [j], currentMin: [minIndex], swap: [], sorted: sortedIndices.slice(), desc: comparingDesc, codeLines: [6], done: false });
            compact.push({ type: 'comparing', a: preCompareState, i, j, minIndex, compare: [j], currentMin: [minIndex], swap: [], sorted: sortedIndices.slice(), desc: comparingDesc, codeLines: [6], done: false });

            if (isNewMin) {
                const oldMinIndex = minIndex;
                minIndex = j;
                detailed.push({ type: 'min-update', a: preCompareState, i, j, minIndex, compare: [], currentMin: [minIndex], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('min-update', { i, j, a: preCompareState, orderText, minIndex, oldMinIndex }), codeLines: [7], done: false });
                compact.push(detailed[detailed.length - 1]); // Add min-update to compact
            }

             detailed.push({ type: 'end-inner-if', a: a.slice(), i, j, minIndex, compare: [], currentMin: [minIndex], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('end-inner-if', { i, j }), codeLines: [8], done: false });
             // Don't add end-inner-if to compact
        } // End inner loop

        detailed.push({ type: 'inner-loop-complete', a: a.slice(), i, j: null, minIndex, compare: [], currentMin: [minIndex], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('inner-loop-complete', { i, a: a.slice(), orderText, minIndex, n }), codeLines: [9], done: false });
        compact.push(detailed[detailed.length - 1]);

        const swapNeeded = minIndex !== i;
        detailed.push({ type: 'check-swap', a: a.slice(), i, j: null, minIndex, compare: [], currentMin: [minIndex], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('check-swap', { i, minIndex, swapNeeded }), codeLines: [10], done: false });
        compact.push(detailed[detailed.length - 1]);

        if (swapNeeded) {
            const preSwapA = a[i]; // Value at i before swap
            const preSwapB = a[minIndex]; // Value at minIndex before swap
            [a[i], a[minIndex]] = [a[minIndex], a[i]]; // Perform swap
            const postSwapState = a.slice();
            const swappingDesc = createStepDescription('swapping', { i, a: postSwapState, orderText, minIndex, preSwapA, preSwapB });

            // Detailed swap steps
            detailed.push({ type: 'swap-step', a: postSwapState, i, j: null, minIndex, compare: [], currentMin: [], swap: [i, minIndex], sorted: sortedIndices.slice(), desc: createStepDescription('swap-step', { step: 1, stepDesc: `Store original arr[${i}] (value ${preSwapA}) in 'temp'.` }), codeLines: [12], animateSwapStep: false, done: false });
            detailed.push({ type: 'swap-step', a: postSwapState, i, j: null, minIndex, compare: [], currentMin: [], swap: [i, minIndex], sorted: sortedIndices.slice(), desc: createStepDescription('swap-step', { step: 2, stepDesc: `Set arr[${i}] = original arr[${minIndex}] (value ${a[i]}).` }), codeLines: [13], animateSwapStep: false, done: false });
            detailed.push({ type: 'swap-step', a: postSwapState, i, j: null, minIndex, compare: [], currentMin: [], swap: [i, minIndex], sorted: sortedIndices.slice(), desc: createStepDescription('swap-step', { step: 3, stepDesc: `Set arr[${minIndex}] = temp (value ${a[minIndex]}).` }), codeLines: [14], animateSwapStep: false, done: false });

            // Compact swap step (includes animation trigger)
            compact.push({ type: 'swap', a: postSwapState, i, j: null, minIndex, compare: [], currentMin: [], swap: [i, minIndex], sorted: sortedIndices.slice(), desc: swappingDesc, codeLines: [11, 12, 13, 14], isCombined: true, animateSwapStep: true, done: false });

        } else {
            detailed.push({ type: 'no-swap', a: a.slice(), i, j: null, minIndex, compare: [], currentMin: [], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('no-swap', { i, orderText }), codeLines: [15], done: false }); // After condition is false
            compact.push(detailed[detailed.length - 1]);
        }

        sortedIndices[i] = true; // Mark element i as sorted after the pass

        detailed.push({ type: 'pass-complete', a: a.slice(), i, j: null, minIndex: null, compare: [], currentMin: [], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('pass-complete', { i, a: a.slice(), n }), codeLines: [16], passComplete: true, passNumber: i + 1, done: false });
        compact.push(detailed[detailed.length - 1]);

    } // End outer loop

    sortedIndices.fill(true); // Mark all as sorted
    const finalStep = { type: 'sorting-complete', a: a.slice(), i: null, j: null, minIndex: null, compare: [], currentMin: [], swap: [], sorted: sortedIndices.slice(), desc: createStepDescription('sorting-complete', { a: a.slice(), orderText }), done: true, codeLines: [17, 18] };
    detailed.push(finalStep);
    compact.push(finalStep);

    return { detailedSteps: detailed, compactSteps: compact };
}
// --- End prepareSelectionSortSteps ---

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
            div.setAttribute("data-idx", String(idx));
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
    let isAnimatedSwapStep = animate && step.swap && step.swap.length === 2 && step.animateSwapStep && stepMode === 'compact';

    // Determine the array state *before* the animation starts
    if (isAnimatedSwapStep) {
        let lookBackIndex = currentStep - 1;
        let actualPrevStep = null;
        while (lookBackIndex >= 0) {
            actualPrevStep = steps[lookBackIndex];
            // Stop if we find the 'check-swap' step for the same i in compact mode
            if (actualPrevStep && actualPrevStep.i === step.i && actualPrevStep.type === 'check-swap') {
                break;
            }
             if (lookBackIndex < currentStep - 5) { // Safety break
                actualPrevStep = null; break;
             }
            lookBackIndex--;
        }
        if (actualPrevStep && actualPrevStep.a) {
             displayArray = actualPrevStep.a.slice();
        } else {
             console.warn("Could not find previous state for swap animation, rendering target state.");
             isAnimatedSwapStep = false; // Fallback
        }
    }

    // Create array cells
    displayArray.forEach((val, idx) => {
        const div = document.createElement("div");
        div.classList.add("array-cell");
        const sortedIndices = Array.isArray(step.sorted) ? step.sorted : [];
        const compareIndices = Array.isArray(step.compare) ? step.compare : [];
        const swapIndices = Array.isArray(step.swap) ? step.swap : [];
        const currentMinIndices = Array.isArray(step.currentMin) ? step.currentMin : [];

        // Apply classes: Sorted takes precedence
        if (step.passComplete && sortedIndices[idx]) div.classList.add("pass-complete");
        else if (sortedIndices[idx]) div.classList.add("sorted");
        else if (currentMinIndices.includes(idx)) div.classList.add("current-min");
        else if (compareIndices.includes(idx)) div.classList.add("compare");

        // Swap class for animation trigger
        if (swapIndices.includes(idx) && isAnimatedSwapStep) div.classList.add("swap");

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
         // Safety check for post-render state
         let displayedValues = Array.from(arrayView.querySelectorAll('.array-cell:not(.warning-cell)'))
             .map(cell => Number(cell.childNodes[0]?.textContent?.trim() || NaN))
             .filter(v => !isNaN(v));
         if (JSON.stringify(displayedValues) !== JSON.stringify(step.a)) {
             console.log("Post-render mismatch detected, re-rendering final step state.");
             renderArray(step, false);
         }
        if (typeof onSwapDone === "function") setTimeout(onSwapDone, 0);
    }
}

// 3-Stage Swap animation (can reuse from Bubble Sort)
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
    const liftY = -30;

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
    if (step.i !== null && step.i !== undefined) parts.push(`<b>i (pass/sorted boundary)</b> = ${step.i}`);
    if (step.j !== null && step.j !== undefined) parts.push(`<b>j (scanning)</b> = ${step.j}`);
    if (step.minIndex !== null && step.minIndex !== undefined) parts.push(`<b>minIndex</b> = ${step.minIndex}`);


    if (step.done) variableState.innerHTML = `<b>Sorting Completed</b>`;
    else if (parts.length > 0) variableState.innerHTML = parts.join("&nbsp;&nbsp;|&nbsp;&nbsp;");
    else variableState.innerHTML = "Processing...";
}

function renderStepDesc(step) {
    if (!stepDesc) return;
    stepDesc.innerHTML = step ? step.desc : "<p>Enter an array and click Start.</p>";
    stepDesc.scrollTop = 0;
}

function renderComplexities() {
    if (timeComplexitySpan) timeComplexitySpan.textContent = "O(n²)"; // Always O(n^2)
    if (spaceComplexitySpan) spaceComplexitySpan.textContent = "O(1)";
}

function renderResult(step) {
    if (!resultSpan) return;
    const shouldShow = step?.done;
    resultSpan.classList.toggle('show', shouldShow);

    if (shouldShow) {
        resultSpan.textContent = "🎉 Sorting Completed!";
        if (variableState) variableState.innerHTML = `<b>Sorting Completed</b>`;

        if (!progressSentForThisView) {
            console.log('Visualization complete or terminated, sending viewing time.');
            sendVisualizationProgressUpdate();
        }
    } else {
        resultSpan.textContent = "";
    }
}

function highlightCodeLines(lines) {
    if (!codeBlock) return;
    const linesToHighlight = Array.isArray(lines) ? lines : [];
    codeBlock.innerHTML = selectionSortCodeLines.map((line, idx) => {
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
                let delay = step.passComplete ? Math.max(1000, autoplayDelay * 1.5) : autoplayDelay;
                if (needsAnimation) delay = Math.max(50, autoplayDelay / 3);

                if (autoplayTimer) clearTimeout(autoplayTimer);
                autoplayTimer = setTimeout(() => {
                    if (!isPlaying) return;
                    currentStep++;
                    autoplayNext(); // Changed from renderCurrentStep to autoplayNext
                }, delay);
            } else {
                isPlaying = false;
                 // Ensure final result is shown correctly
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
    if (!startTime && currentStep > 0) startTimer(); // Start timer if not already started and not at step 0
    updateButtonState();
    autoplayNext();
}

function autoplayNext() {
    if (!isPlaying) return;
    const isAtEnd = !steps || steps.length === 0 || currentStep >= steps.length || (steps[currentStep] && steps[currentStep].done);

    if (isAtEnd) {
        isPlaying = false;
        // Adjust step index if overshot
        if (currentStep >= steps.length && steps.length > 0) currentStep = steps.length - 1;
        // Render the final step state if we landed on it
        if (steps[currentStep]) renderCurrentStep(false);
        updateButtonState();
        return;
    }
    // Normal progression
    renderCurrentStep(false); // renderCurrentStep now handles the next step scheduling via setTimeout
}

function pauseAutoplay() {
    if (!isPlaying) return;
    if (autoplayTimer) { clearTimeout(autoplayTimer); autoplayTimer = null; }
    isPlaying = false; isSwapping = false;

    if (stepMode === "compact") {
        const newStepIndex = findCorrespondingStep(compactSteps, detailedSteps, currentStep);
        stepMode = "detailed"; steps = detailedSteps; currentStep = newStepIndex;
        renderCurrentStep(true);
    } else {
        renderCurrentStep(true); // Re-render current detailed step to ensure correct state
    }
    updateButtonState();
}
// --- End Autoplay ---

// --- Controls ---
function startVisualization() {
    const raw = arrayInput.value.trim();
    let inputNumbers = raw.length === 0 ? [] : raw.split(",").map(s => s.trim()).filter(s => s.length > 0);

    if (inputNumbers.length === 0) { alert("Please enter at least one number."); return; }
    if (inputNumbers.length > 10) {
        alert("Visualizing only the first 10 numbers.");
        inputNumbers = inputNumbers.slice(0, 10);
        arrayInput.value = inputNumbers.join(', ');
        createLiveArrayVisualization(); // Update input field and preview
    }
    array = inputNumbers.map(Number);
    if (array.some(isNaN)) { alert("Please enter only valid numbers."); return; }

    // Reset timer and progress flag
    stopTimer(); elapsedTime = 0; progressSentForThisView = false;
    startTimer(); // Start timer for the new visualization

    const order = orderSelect.value === "desc" ? "desc" : "asc";
    if (isPlaying) pauseAutoplay(); // Pause if currently playing
    if (autoplayTimer) { clearTimeout(autoplayTimer); autoplayTimer = null; } // Clear any pending timer

    // Generate steps
    const generated = prepareSelectionSortSteps(array, order);
    detailedSteps = generated.detailedSteps; compactSteps = generated.compactSteps;
    stepMode = "detailed"; steps = detailedSteps;
    currentStep = 0; isPlaying = false; isSwapping = false;

    // Render initial state
    renderCurrentStep(true); // Use manual=true for initial render
    renderComplexities();
    updateButtonState(); // Update buttons based on new state
}

// --- Event Listeners Setup --- (To be called by initializePageContent)
function setupEventListeners() {
    arrayInput.addEventListener("input", () => {
        // Reset state if user changes input during visualization
        if (isPlaying || startTime || currentStep > 0) {
            if (isPlaying) pauseAutoplay();
            stopTimer(); elapsedTime = 0; progressSentForThisView = false;
            steps = []; detailedSteps = []; compactSteps = []; currentStep = 0;
            highlightCodeLines([]); renderVariableState(null); renderStepDesc(null);
            renderResult(null); updateButtonState();
        }
        createLiveArrayVisualization(); // Update preview
    });

    startBtn.onclick = () => { progressSentForThisView = false; startVisualization(); };

    pausePlayBtn.onclick = () => {
        if (!steps || steps.length === 0) return;
        if (isPlaying) {
            pauseAutoplay();
        } else {
            const isAtEnd = currentStep >= steps.length - 1 || (steps[currentStep] && steps[currentStep].done);
            if (!startTime && !isAtEnd) startTimer(); // Start timer if paused at beginning
            autoplayDelay = calcAutoplayDelay(parseInt(speedSlider.value, 10));
            startAutoplay();
        }
    };

    nextBtn.onclick = () => {
        const isAtEnd = !steps || steps.length === 0 || currentStep >= steps.length - 1 || (steps[currentStep] && steps[currentStep].done);
        if (isSwapping || isPlaying || isAtEnd) return;
        if (!startTime && currentStep === 0) startTimer(); // Start timer if stepping from beginning

        // Ensure detailed mode for manual stepping
        if (stepMode === "compact") {
            const newStepIndex = findCorrespondingStep(compactSteps, detailedSteps, currentStep);
            stepMode = "detailed"; steps = detailedSteps; currentStep = newStepIndex;
             // Render the mapped detailed step immediately before incrementing
            renderCurrentStep(true);
            // Now check if we can increment
            if (currentStep < steps.length - 1) {
                currentStep++;
                renderCurrentStep(true);
            }
            return; // Exit after handling mode switch
        }
        // If already in detailed mode, just increment
        currentStep++;
        renderCurrentStep(true);
    };

    prevBtn.onclick = () => {
        if (isSwapping || isPlaying || currentStep <= 0) return;

        // Ensure detailed mode for manual stepping back
        if (stepMode === "compact") {
            const newStepIndex = findCorrespondingStep(compactSteps, detailedSteps, currentStep);
            stepMode = "detailed"; steps = detailedSteps; currentStep = newStepIndex;
            // No need to render immediately, just adjust index
        }
        // If already detailed or just switched, decrement
        if (currentStep > 0) currentStep--;
        renderCurrentStep(true);
    };


    speedSlider.oninput = () => {
        autoplayDelay = calcAutoplayDelay(parseInt(speedSlider.value, 10));
        speedValue.textContent = `${speedSlider.value}`;
        // Adjust timer immediately if playing
        if (isPlaying && autoplayTimer) {
            clearTimeout(autoplayTimer);
            autoplayTimer = setTimeout(() => {
                if (!isPlaying) return;
                // Don't advance step here, just reschedule next one
                autoplayNext(); // Should call renderCurrentStep which handles scheduling
            }, autoplayDelay);
        }
    };

    arrayInput.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault(); // Prevent form submission if inside a form
            progressSentForThisView = false;
            startVisualization();
        }
    });

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
         quizButton.addEventListener('click', quiz_btn);
     }

    // Ripple effect
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', function (e) {
            if (this.disabled) return;
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height) * 1.5;
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            this.appendChild(ripple);
            setTimeout(() => { if (ripple.parentNode) ripple.remove(); }, 600);
        });
    });

    // Send data on visibility change or unload
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            stopTimer();
            if (!progressSentForThisView && elapsedTime >= 5) {
                if (navigator.sendBeacon) sendVisualizationProgressBeacon();
                else sendVisualizationProgressUpdate();
            }
        } else if (document.visibilityState === 'visible') {
             // Optional: Resume timer only if visualization was active?
             // Or let the user restart it via Play button. Simpler not to auto-resume.
        }
    });
    // Use pagehide for broader compatibility, including mobile backgrounding
    window.addEventListener('pagehide', (event) => {
        // event.persisted is true for bfcache, false for actual unload/close
        if (!event.persisted) {
             stopTimer(); // Ensure timer stops and final time is calculated
             if (!progressSentForThisView && elapsedTime >= 5) {
                 // Try Beacon first for unload
                 const beaconSent = navigator.sendBeacon ? sendVisualizationProgressBeacon() : false;
                 // Maybe fallback to sync XHR if beacon fails/not supported, but risky
                 // if (!beaconSent) sendVisualizationProgressUpdateSync(); // Avoid if possible
             }
        }
    });

}
// --- End Event Listeners ---

// --- Chart Generation ---
let myComplexityChart = null;
let mySpaceComplexityChart = null;

function createComplexityChart() {
    const ctx = document.getElementById('complexityChart');
    if (!ctx) { console.error("Canvas element for time chart not found!"); return; }
    if (myComplexityChart) { myComplexityChart.destroy(); }

    const labels = []; const dataPoints = [];
    const maxN = 25; const step = Math.max(1, Math.floor(maxN / 10));
    for (let n = 0; n <= maxN; n += step) { labels.push(n); dataPoints.push(n * n); }
    if (labels[labels.length - 1] < maxN) { labels.push(maxN); dataPoints.push(maxN * maxN); }

    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
    const gridColor = isDarkMode ? 'rgba(100, 116, 139, 0.2)' : 'rgba(203, 213, 225, 0.5)';
    const labelColor = isDarkMode ? '#cbd5e1' : '#475569';
    const pointColor = isDarkMode ? '#f87171' : '#ef4444'; // Use Red for O(n^2)

    myComplexityChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Operations (Approx. n²)', data: dataPoints, borderColor: pointColor, backgroundColor: 'rgba(239, 68, 68, 0.1)', tension: 0.1, pointRadius: 3, pointBackgroundColor: pointColor, fill: true, }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `~${ctx.parsed.y} ops for n=${ctx.parsed.x}` } }, title: { display: true, text: 'Time Complexity Growth (O(n²))', color: labelColor, font: { size: 14, weight: 'bold', family: 'Inter, sans-serif' }, padding: { top: 0, bottom: 10 } } },
            scales: { x: { title: { display: true, text: 'Input Size (n)', color: labelColor, font: { family: 'Inter, sans-serif' } }, grid: { color: gridColor }, ticks: { color: labelColor, font: { family: 'Inter, sans-serif' } } }, y: { title: { display: true, text: 'Operations', color: labelColor, font: { family: 'Inter, sans-serif' } }, beginAtZero: true, grid: { color: gridColor }, ticks: { color: labelColor, font: { family: 'Inter, sans-serif' } } } }
        }
    });
    window.myComplexityChart = myComplexityChart;
}

function updateChartTheme(chart) {
    if (!chart) return;
    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
    const gridColor = isDarkMode ? 'rgba(100, 116, 139, 0.2)' : 'rgba(203, 213, 225, 0.5)';
    const labelColor = isDarkMode ? '#cbd5e1' : '#475569';
    const pointColor = isDarkMode ? '#f87171' : '#ef4444'; // Red

    chart.options.plugins.title.color = labelColor;
    chart.options.scales.x.title.color = labelColor; chart.options.scales.x.grid.color = gridColor; chart.options.scales.x.ticks.color = labelColor;
    chart.options.scales.y.title.color = labelColor; chart.options.scales.y.grid.color = gridColor; chart.options.scales.y.ticks.color = labelColor;
    chart.data.datasets[0].borderColor = pointColor; chart.data.datasets[0].pointBackgroundColor = pointColor;
    chart.data.datasets[0].backgroundColor = isDarkMode ? 'rgba(248, 113, 113, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    chart.update();
}

function createSpaceComplexityChart() {
    const ctx = document.getElementById('spaceComplexityChart');
    if (!ctx) { console.error("Canvas element for space chart not found!"); return; }
    if (mySpaceComplexityChart) { mySpaceComplexityChart.destroy(); }

    const labels = []; const dataPoints = [];
    const maxN = 25; const step = Math.max(1, Math.floor(maxN / 10));
    for (let n = 0; n <= maxN; n += step) { labels.push(n); dataPoints.push(1); }
    if (labels[labels.length - 1] < maxN) { labels.push(maxN); dataPoints.push(1); }

    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
    const gridColor = isDarkMode ? 'rgba(100, 116, 139, 0.2)' : 'rgba(203, 213, 225, 0.5)';
    const labelColor = isDarkMode ? '#cbd5e1' : '#475569';
    const pointColor = isDarkMode ? '#34d399' : '#10b981'; // Green
    const bgColor = isDarkMode ? 'rgba(52, 211, 153, 0.1)' : 'rgba(16, 185, 129, 0.1)';

    mySpaceComplexityChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Space Units (Approx. 1)', data: dataPoints, borderColor: pointColor, backgroundColor: bgColor, tension: 0, pointRadius: 3, pointBackgroundColor: pointColor, fill: true, stepped: true }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `~${ctx.parsed.y} space unit(s) for n=${ctx.parsed.x}` } }, title: { display: true, text: 'Space Complexity Growth (O(1))', color: labelColor, font: { size: 14, weight: 'bold', family: 'Inter, sans-serif' }, padding: { top: 0, bottom: 10 } } },
            scales: { x: { title: { display: true, text: 'Input Size (n)', color: labelColor, font: { family: 'Inter, sans-serif' } }, grid: { color: gridColor }, ticks: { color: labelColor, font: { family: 'Inter, sans-serif' } } }, y: { title: { display: true, text: 'Space Units', color: labelColor, font: { family: 'Inter, sans-serif' } }, beginAtZero: true, grid: { color: gridColor }, ticks: { color: labelColor, font: { family: 'Inter, sans-serif' }, maxTicksLimit: 3, stepSize: 1 }, max: 2 } }
        }
    });
    window.mySpaceComplexityChart = mySpaceComplexityChart;
}

function updateSpaceChartTheme(chart) {
    if (!chart) return;
    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
    const gridColor = isDarkMode ? 'rgba(100, 116, 139, 0.2)' : 'rgba(203, 213, 225, 0.5)';
    const labelColor = isDarkMode ? '#cbd5e1' : '#475569';
    const pointColor = isDarkMode ? '#34d399' : '#10b981'; // Green
    const bgColor = isDarkMode ? 'rgba(52, 211, 153, 0.1)' : 'rgba(16, 185, 129, 0.1)';

    chart.options.plugins.title.color = labelColor;
    chart.options.scales.x.title.color = labelColor; chart.options.scales.x.grid.color = gridColor; chart.options.scales.x.ticks.color = labelColor;
    chart.options.scales.y.title.color = labelColor; chart.options.scales.y.grid.color = gridColor; chart.options.scales.y.ticks.color = labelColor;
    chart.data.datasets[0].borderColor = pointColor; chart.data.datasets[0].pointBackgroundColor = pointColor; chart.data.datasets[0].backgroundColor = bgColor;
    chart.update();
}
// --- End Chart Generation ---

// --- Code Snippet Tab Switching and Copy ---
function setupCodeSnippets() {
    const tabs = document.querySelectorAll('.code-tab');
    const snippets = document.querySelectorAll('.code-snippet');
    const copyBtn = document.getElementById('copyCodeBtn');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const lang = tab.getAttribute('data-lang');
            tabs.forEach(t => t.classList.remove('active'));
            snippets.forEach(s => s.classList.remove('active'));
            tab.classList.add('active');
            const activeSnippet = document.getElementById(`code-snippet-${lang}`);
            if (activeSnippet) activeSnippet.classList.add('active');
        });
    });

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const activeSnippet = document.querySelector('.code-snippet.active code');
            if (activeSnippet) {
                navigator.clipboard.writeText(activeSnippet.textContent)
                    .then(() => {
                        const originalIcon = copyBtn.innerHTML;
                        copyBtn.innerHTML = '<i class="fas fa-check text-green-500"></i>'; copyBtn.title = "Copied!";
                        setTimeout(() => { copyBtn.innerHTML = originalIcon; copyBtn.title = "Copy Code"; }, 1500);
                    })
                    .catch(err => { console.error('Failed to copy code: ', err); alert('Failed to copy code.'); });
            }
        });
    }
}
// --- End Code Snippet ---

// --- Navigation to Practice Quiz ---
function quiz_btn() {
    console.log("Navigating to practice quiz...");
    stopTimer(); // Stop timer before navigating
    if (!progressSentForThisView && elapsedTime >= 5) {
        // Try to send progress before leaving
        if (navigator.sendBeacon) sendVisualizationProgressBeacon();
        else sendVisualizationProgressUpdate(); // Fallback
    }
    // Adjust path as needed
    window.location.href = "practice_logic.html";
}
// --- End Navigation ---

// --- Progress Update Logic ---
async function sendVisualizationProgressUpdate() {
    const token = localStorage.getItem('authToken');
    if (!token || progressSentForThisView) return;

    const timeSpentSeconds = elapsedTime;
    // Only send if significant time spent (e.g., >= 5 seconds)
    if (timeSpentSeconds < 5) {
         console.log(`Time spent (${timeSpentSeconds}s) too short, not sending update.`);
         // Reset timer state but don't mark as sent
         elapsedTime = 0;
         startTime = null;
         return;
    }


    const progressData = {
        category: 'sorting', // Match topic ID
        algorithm: 'selectionSort', // Match algorithm ID
        data: {
            timeSpentViz: timeSpentSeconds,
            lastAttemptViz: new Date()
            // No accuracy or completion data for visualization view
        }
    };
    console.log('Sending visualization progress update via Fetch:', progressData);
    progressSentForThisView = true; // Mark as sent *before* async call

    try {
        const response = await fetch(`${API_BASE_URL}/auth/progress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(progressData),
            keepalive: true // Important for unload scenarios
        });

        if (!response.ok) {
            let errorMsg = `HTTP error ${response.status}`;
            try { const result = await response.json(); errorMsg = result.message || errorMsg; } catch (e) {}
            throw new Error(errorMsg);
        }

        const result = await response.json();
        console.log('Visualization progress update successful (Fetch):', result);
        // Reset timer state *only* on successful send
        elapsedTime = 0;
        startTime = null;
    } catch (error) {
        progressSentForThisView = false; // Allow retrying if send failed
        console.error('Error sending visualization progress update (Fetch):', error);
        // Optionally alert the user?
        // alert(`Could not save visualization time: ${error.message}`);
    }
}

function sendVisualizationProgressBeacon() {
    const token = localStorage.getItem('authToken');
    if (!token || progressSentForThisView) return false;

    const timeSpentSeconds = elapsedTime;
    if (timeSpentSeconds < 5) return false; // Don't send trivial times

    const progressData = {
        category: 'sorting',
        algorithm: 'selectionSort',
        data: { timeSpentViz: timeSpentSeconds, lastAttemptViz: new Date() }
    };
    console.log('Sending visualization progress update via Beacon:', progressData);
    progressSentForThisView = true; // Assume success with Beacon
    const blob = new Blob([JSON.stringify(progressData)], { type: 'application/json' });

    // Include token in URL (less secure but common for Beacon) or use alternative method if backend supports
    const beaconURL = `${API_BASE_URL}/auth/progress?authToken=${encodeURIComponent(token)}`;

    try {
        const success = navigator.sendBeacon(beaconURL, blob);
        if (success) {
            console.log("Beacon queued successfully.");
            elapsedTime = 0; startTime = null; // Reset timer state on successful queuing
            return true;
        } else {
            console.warn("navigator.sendBeacon returned false.");
            progressSentForThisView = false; // Allow fallback if queuing failed
            return false;
        }
    } catch (error) {
        progressSentForThisView = false; // Allow fallback on error
        console.error('Error calling navigator.sendBeacon:', error);
        return false;
    }
}
// --- End Progress Update ---


// --- Initialize Page Content (Called after access check) ---
function initializePageContent() {
    console.log("Initializing Selection Sort Visualization page content...");

    const themeManager = new ThemeManager();
    progressSentForThisView = false; // Reset progress flag on load

    // Initial UI setup
    createLiveArrayVisualization();
    renderVariableState(null);
    renderStepDesc({ desc: "<p>Enter numbers and click 'Start Sorting'.</p>"}); // Initial message
    resultSpan.textContent = "";
    highlightCodeLines([]); // Show code without highlight
    renderComplexities();
    updateButtonState(); // Ensure buttons are initially disabled correctly

    // Create charts
    createComplexityChart();
    createSpaceComplexityChart();

    // Setup code tabs
    setupCodeSnippets();

    // Setup all event listeners
    setupEventListeners();

    // Initial layout check
    handleArrayLayout();

    console.log("Selection Sort Visualization page fully initialized.");
}

// --- End Initialization ---

