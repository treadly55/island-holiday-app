# Island Holiday Recommendation App

A full-stack AI-powered web application that provides personalized island destination recommendations using RAG (Retrieval-Augmented Generation) with vector search.

## 🏝️ Features

- **Smart Recommendations**: Uses AI to match user preferences with island destinations
- **Vector Search**: Semantic search powered by OpenAI embeddings and Supabase
- **Dynamic Navigation**: Handles any number of recommendations (1-N results)
- **Modern UI**: Custom-styled form controls with real-time validation
- **Error Handling**: Smart detection of database and API issues
- **Loading States**: Animated loading overlay with status updates

## Tech Stack

- **Frontend**: Vanilla JavaScript, CSS, HTML
- **Backend**: Netlify Functions (Serverless)
- **Database**: Supabase (PostgreSQL with vector extensions)
- **AI Services**: OpenAI (Embeddings + GPT-4)
- **Deployment**: Netlify


## 🔄 How the RAG System Works

1. **User submits form** → Frontend sends preferences to API
2. **Query creation** → User preferences converted to search query
3. **Embedding generation** → Query converted to vector using OpenAI
4. **Vector search** → Supabase finds similar content chunks using RPC function
5. **AI generation** → OpenAI generates recommendations based on retrieved chunks
6. **Response** → Formatted recommendations returned to frontend


## 🚀 Quick Start

The application uses Supabase as a vector database to store and search through text chunks using semantic similarity. Here's what was configured:

#### Vector Extension
First, the `vector` extension was enabled to support embedding storage and similarity search:

#### Database Table
The `island_chunks` table stores processed text chunks with their vector embeddings:

## 📥 Adding Your Own Data

To use this system with your own content, follow these steps:

### 1. Prepare Your Data File

Create a `islands_data.json` file (or rename it for your domain) with your content:


### 2. Process and Upload Your Data

The `prepare_data.js` script will automatically:
- Read your JSON file
- Split long descriptions into smaller chunks (500 characters by default)
- Generate OpenAI embeddings for each chunk
- Store chunks and embeddings in your Supabase database

Run the data processing script:

```bash
node prepare_data.js
```

The script will:
1. **Load** your `islands_data.json` file
2. **Chunk** each description using RecursiveCharacterTextSplitter
3. **Embed** each chunk using OpenAI's `text-embedding-ada-002` model
4. **Store** the chunks and embeddings in Supabase


**What happens during processing:**
```
Loading 3 island descriptions from islands_data.json.
--- Processing: Bali, Indonesia ---
  Split into 2 chunks.
  Storing 2 chunks in Supabase...
  Successfully stored 2 chunks for Bali, Indonesia.
--- Processing: Santorini, Greece ---
  Split into 2 chunks.
  Storing 2 chunks in Supabase...
  Successfully stored 2 chunks for Santorini, Greece.
--- Processing Complete ---
Total chunks created: 6
Total chunks successfully stored: 6
```

### 3. Configure Chunking (Optional)

You can adjust the chunking parameters in `prepare_data.js`:

```javascript
const CHUNK_SIZE = 500;        // Characters per chunk
const CHUNK_OVERLAP = 50;      // Overlap between chunks for continuity
```

**Chunking Strategy:**
- **Smaller chunks** (300-500 chars): Better for precise matching, more chunks per item
- **Larger chunks** (800-1200 chars): Better context retention, fewer chunks per item
- **Overlap**: Ensures important information isn't lost at chunk boundaries

### 4. Verify Your Data

After running the script, check your Supabase dashboard:
- Go to Table Editor → `island_chunks`
- You should see rows with your destinations, chunk text, and embeddings
- Each embedding should be a 1536-dimensional vector

## 📁 Project Structure

```
island-recommendation-app/
├── src/
│   ├── main.js              # Frontend logic
│   ├── style.css            # Styling
│   └── imageData.js         # Image assets
├── netlify/
│   └── functions/
│       └── get-recommendation.js  # API endpoint
├── public/
│   └── images/              # Static images
├── index.html               # Main HTML file
├── prepare_data.js          # Data processing script
├── islands_data.json        # Source data
├── package.json
├── .env                     # Environment variables
└── README.md
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.