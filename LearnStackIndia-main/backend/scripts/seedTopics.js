// scripts/seedTopics.js - Seed topic data
const mongoose = require('mongoose');
const Topic = require('../models/Topic');
require('dotenv').config();

const topicsData = [
  {
    id: 'searching',
    name: 'Searching Algorithms',
    description: 'Learn various searching techniques to find elements efficiently',
    icon: 'search',
    color: 'blue',
    order: 1,
    estimatedTime: 8,
    difficulty: 'beginner',
    prerequisites: [],
    algorithms: [
      {
        id: 'linearSearch',
        name: 'Linear Search',
        description: 'Sequential search through array elements',
        difficulty: 'easy',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        points: 50,
        prerequisites: []
      },
      {
        id: 'binarySearch',
        name: 'Binary Search',
        description: 'Efficient search in sorted arrays',
        difficulty: 'easy',
        timeComplexity: 'O(log n)',
        spaceComplexity: 'O(1)',
        points: 75,
        prerequisites: ['linearSearch']
      },
      {
        id: 'jumpSearch',
        name: 'Jump Search',
        description: 'Jump ahead by fixed steps then linear search',
        difficulty: 'medium',
        timeComplexity: 'O(√n)',
        spaceComplexity: 'O(1)',
        points: 100,
        prerequisites: ['binarySearch']
      },
      {
        id: 'interpolationSearch',
        name: 'Interpolation Search',
        description: 'Search based on value distribution',
        difficulty: 'medium',
        timeComplexity: 'O(log log n)',
        spaceComplexity: 'O(1)',
        points: 100,
        prerequisites: ['binarySearch']
      },
      {
        id: 'exponentialSearch',
        name: 'Exponential Search',
        description: 'Find range then binary search',
        difficulty: 'medium',
        timeComplexity: 'O(log n)',
        spaceComplexity: 'O(1)',
        points: 100,
        prerequisites: ['binarySearch']
      },
      {
        id: 'ternarySearch',
        name: 'Ternary Search',
        description: 'Divide array into three parts',
        difficulty: 'medium',
        timeComplexity: 'O(log₃ n)',
        spaceComplexity: 'O(1)',
        points: 100,
        prerequisites: ['binarySearch']
      },
      {
        id: 'fibonacciSearch',
        name: 'Fibonacci Search',
        description: 'Search using Fibonacci numbers',
        difficulty: 'hard',
        timeComplexity: 'O(log n)',
        spaceComplexity: 'O(1)',
        points: 125,
        prerequisites: ['binarySearch']
      },
      {
        id: 'sentinelSearch',
        name: 'Sentinel Linear Search',
        description: 'Optimized linear search',
        difficulty: 'easy',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        points: 50,
        prerequisites: ['linearSearch']
      }
    ],
    isActive: true
  },
  {
    id: 'sorting',
    name: 'Sorting Algorithms',
    description: 'Master different sorting techniques and their applications',
    icon: 'sort-amount-up',
    color: 'green',
    order: 2,
    estimatedTime: 12,
    difficulty: 'beginner',
    prerequisites: [],
    algorithms: [
      {
        id: 'bubbleSort',
        name: 'Bubble Sort',
        description: 'Repeatedly swap adjacent elements',
        difficulty: 'easy',
        timeComplexity: 'O(n²)',
        spaceComplexity: 'O(1)',
        points: 50, // Points awarded for practice completion or visualization
        prerequisites: []
      },
      {
        id: 'selectionSort',
        name: 'Selection Sort',
        description: 'Find minimum and place at beginning',
        difficulty: 'easy',
        timeComplexity: 'O(n²)',
        spaceComplexity: 'O(1)',
        points: 50,
        prerequisites: []
      },
      {
        id: 'insertionSort',
        name: 'Insertion Sort',
        description: 'Build sorted array one element at a time',
        difficulty: 'easy',
        timeComplexity: 'O(n²)',
        spaceComplexity: 'O(1)',
        points: 75,
        prerequisites: []
      },
      {
        id: 'mergeSort',
        name: 'Merge Sort',
        description: 'Divide and conquer sorting',
        difficulty: 'medium',
        timeComplexity: 'O(n log n)',
        spaceComplexity: 'O(n)',
        points: 100,
        prerequisites: ['insertionSort']
      },
      {
        id: 'quickSort',
        name: 'Quick Sort',
        description: 'Partition-based sorting',
        difficulty: 'medium',
        timeComplexity: 'O(n log n)',
        spaceComplexity: 'O(log n)',
        points: 125,
        prerequisites: ['insertionSort']
      },
      {
        id: 'heapSort',
        name: 'Heap Sort',
        description: 'Sorting using heap data structure',
        difficulty: 'hard',
        timeComplexity: 'O(n log n)',
        spaceComplexity: 'O(1)',
        points: 150,
        prerequisites: ['mergeSort']
      },
      {
        id: 'countingSort',
        name: 'Counting Sort',
        description: 'Integer sorting using counting',
        difficulty: 'medium',
        timeComplexity: 'O(n+k)',
        spaceComplexity: 'O(k)',
        points: 100,
        prerequisites: []
      },
      {
        id: 'radixSort',
        name: 'Radix Sort',
        description: 'Digit by digit sorting',
        difficulty: 'hard',
        timeComplexity: 'O(d×n)',
        spaceComplexity: 'O(n+k)',
        points: 150,
        prerequisites: ['countingSort']
      }
    ],
    isActive: true
  },
  // Add remaining topics (stack, queue, linkedList, tree, graph, hashTable) similarly
  {
    id: 'stack',
    name: 'Stack Data Structure',
    description: 'LIFO data structure and its applications',
    icon: 'layer-group',
    color: 'purple',
    order: 3,
    estimatedTime: 10,
    difficulty: 'intermediate',
    prerequisites: ['sorting'],
    algorithms: [
      { id: 'basicOperations', name: 'Stack Operations', description: 'Push, Pop, Peek operations', difficulty: 'easy', timeComplexity: 'O(1)', spaceComplexity: 'O(n)', points: 50, prerequisites: [] },
      { id: 'balancedParentheses', name: 'Balanced Parentheses', description: 'Check bracket matching', difficulty: 'easy', timeComplexity: 'O(n)', spaceComplexity: 'O(n)', points: 75, prerequisites: ['basicOperations'] },
      { id: 'infixToPostfix', name: 'Infix to Postfix', description: 'Expression conversion', difficulty: 'medium', timeComplexity: 'O(n)', spaceComplexity: 'O(n)', points: 100, prerequisites: ['balancedParentheses'] },
      { id: 'nextGreaterElement', name: 'Next Greater Element', description: 'Find next greater elements', difficulty: 'medium', timeComplexity: 'O(n)', spaceComplexity: 'O(n)', points: 100, prerequisites: ['basicOperations'] },
      { id: 'stockSpanProblem', name: 'Stock Span Problem', description: 'Calculate stock span', difficulty: 'medium', timeComplexity: 'O(n)', spaceComplexity: 'O(n)', points: 100, prerequisites: ['nextGreaterElement'] },
      { id: 'largestRectangle', name: 'Largest Rectangle', description: 'Largest rectangle in histogram', difficulty: 'hard', timeComplexity: 'O(n)', spaceComplexity: 'O(n)', points: 150, prerequisites: ['stockSpanProblem'] },
      { id: 'minStack', name: 'Min Stack', description: 'Stack with min operation', difficulty: 'medium', timeComplexity: 'O(1)', spaceComplexity: 'O(n)', points: 100, prerequisites: ['basicOperations'] },
      { id: 'stackWithTwoQueues', name: 'Stack Using Queues', description: 'Implement stack with queues', difficulty: 'medium', timeComplexity: 'O(n)', spaceComplexity: 'O(n)', points: 100, prerequisites: ['basicOperations'] }
    ],
    isActive: true
  }
];

async function seedTopics() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB!');

    console.log('🔄 Clearing existing topics...');
    await Topic.deleteMany({});

    console.log('🔄 Inserting topics...');
    await Topic.insertMany(topicsData);

    console.log(`✅ Successfully seeded ${topicsData.length} topics!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding topics:', error);
    process.exit(1);
  }
}

seedTopics();