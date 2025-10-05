# NLP Module for Creative Dream Pipeline

This module provides Natural Language Processing capabilities for the Creative Dream Pipeline, enabling semantic understanding of user prompts.

## Components

### 1. NLPWrapper

A wrapper around the Compromise.js library that provides easy-to-use methods for extracting linguistic features from text.

**Features:**

- Extract nouns with singular/plural detection
- Extract verbs with tense information
- Extract adjectives and modifiers
- Extract numbers and prepositions
- Get sentence structure
- Pattern matching

**Usage:**

```javascript
const { NLPWrapper } = require('./nlp');

const nlp = new NLPWrapper();

// Extract nouns
const nouns = nlp.extractNouns('two dragons circling a castle');
// Returns: [
//   { text: 'two dragons', isPlural: true, isSingular: false, isProper: false },
//   { text: 'a castle', isPlural: false, isSingular: true, isProper: false }
// ]

// Extract verbs
const verbs = nlp.extractVerbs('flying through the sky');
// Returns: [
//   { text: 'flying', isGerund: true, isPastTense: false, isPresentTense: true }
// ]

// Get sentence structure
const structure = nlp.getSentenceStructure('two dragons circling a castle');
// Returns: {
//   subjects: ['dragons', 'castle'],
//   verbs: ['circling'],
//   objects: [],
//   adjectives: [],
//   prepositions: []
// }
```

### 2. TextPreprocessor

Handles text normalization, cleaning, and tokenization.

**Features:**

- Text normalization (lowercase, trim, remove extra spaces)
- Punctuation handling
- Capitalization control (title case, sentence case, etc.)
- Tokenization (words and sentences)
- Stop word removal
- Contraction expansion
- Whitespace normalization

**Usage:**

```javascript
const { TextPreprocessor } = require('./nlp');

const preprocessor = new TextPreprocessor();

// Normalize text
const normalized = preprocessor.normalize('  TWO   DRAGONS  ');
// Returns: 'two dragons'

// Tokenize
const tokens = preprocessor.tokenize('two dragons circling a castle');
// Returns: ['two', 'dragons', 'circling', 'a', 'castle']

// Remove stop words
const tokensNoStop = preprocessor.tokenize(
  'two dragons circling a castle',
  true
);
// Returns: ['two', 'dragons', 'circling', 'castle']

// Clean text
const cleaned = preprocessor.clean('  HELLO,  WORLD!!!  ', {
  lowercase: true,
  removePunctuation: true,
  removeExtraSpaces: true,
});
// Returns: 'hello world'
```

## Installation

The module uses Compromise.js as its NLP engine:

```bash
npm install compromise
```

## Testing

Run the test scripts to verify functionality:

```bash
# Test NLP Wrapper
node nlp/test-nlp-wrapper.js

# Test Text Preprocessor
node nlp/test-text-preprocessor.js
```

## Requirements Satisfied

This module satisfies the following requirements from the Creative Dream Pipeline spec:

- **Requirement 1.1**: Semantic Scene Understanding - Extract entities, verbs, and adjectives
- **Requirement 1.2**: Count Inference - Detect singular/plural nouns
- **Requirement 2.1-2.12**: Motion & Action Mapping - Extract action verbs
- **Requirement 1.4**: Mood Detection - Extract descriptive adjectives

### 3. EntityExtractor

Extracts and classifies entities (nouns) from text with count inference and type classification.

**Features:**

- Extract entities with singular/plural detection
- Infer counts from explicit numbers, collective nouns, and quantifiers
- Classify entities by type (living_creature, vehicle, structure, etc.)
- Detect proper nouns
- Group entities by type

**Usage:**

```javascript
const { EntityExtractor } = require('./nlp');

const extractor = new EntityExtractor();

// Extract entities
const entities = extractor.extractEntities('two dragons circling a castle');
// Returns: [
//   { text: 'two dragons', count: 2, type: 'living_creature', isPlural: true },
//   { text: 'a castle', count: 1, type: 'structure', isSingular: true }
// ]

// Collective noun inference
const entities2 = extractor.extractEntities('a herd of horses');
// Returns: [{ text: 'a herd of horses', count: 8, isCollective: true }]
```

### 4. VerbExtractor

Extracts and classifies action verbs with motion categorization and intensity detection.

**Features:**

- Extract verbs with tense information
- Categorize by motion type (aerial, ground, water, circular, event, etc.)
- Detect verb intensity (low, medium, high)
- Identify motion vs event verbs
- Suggest default motion for static scenes

**Usage:**

```javascript
const { VerbExtractor } = require('./nlp');

const extractor = new VerbExtractor();

// Extract verbs
const verbs = extractor.extractVerbs('dragons flying swiftly');
// Returns: [
//   { text: 'flying', category: 'aerial', intensity: 'medium', isMotionVerb: true }
// ]

// Get dominant motion type
const dominantMotion = extractor.getDominantMotionType(
  'birds soaring and gliding'
);
// Returns: 'aerial'
```

### 5. ModifierExtractor

Extracts adjectives, colors, sizes, moods, and other descriptive modifiers.

**Features:**

- Extract adjectives and mood words
- Detect colors, sizes, and speed modifiers
- Extract weather and time descriptors
- Generate visual style hints
- Suggest enhancements based on modifiers

**Usage:**

```javascript
const { ModifierExtractor } = require('./nlp');

const extractor = new ModifierExtractor();

// Extract all modifiers
const modifiers = extractor.extractAllModifiers(
  'ethereal golden dragons at sunset'
);
// Returns: {
//   adjectives: ['ethereal', 'golden'],
//   moods: [{ word: 'ethereal', mood: 'ethereal' }],
//   colors: ['golden'],
//   time: ['sunset']
// }

// Get visual style hints
const hints = extractor.getVisualStyleHints('dark stormy castle');
// Returns: { lighting: 'dark', atmosphere: 'stormy', effects: ['shadows', 'fog'] }
```

## Next Steps

The following modules will build on this NLP infrastructure:

1. **SemanticAnalyzer** - Comprehensive semantic analysis combining all extractors (Task 2)
2. **MotionMapper** - Map verbs to animation behaviors (Task 3)
3. **EventGenerator** - Create dynamic events from verbs (Task 4)
4. **CameraDirector** - Generate cinematic camera movements (Task 5)

## Architecture

```
nlp/
├── index.js              # Module entry point
├── NLPWrapper.js         # Compromise.js wrapper
├── TextPreprocessor.js   # Text preprocessing utilities
├── test-nlp-wrapper.js   # NLP wrapper tests
├── test-text-preprocessor.js  # Preprocessor tests
└── README.md             # This file
```

## Dependencies

- **compromise**: ^14.x - Lightweight NLP library for JavaScript
