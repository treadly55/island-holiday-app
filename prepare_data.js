import fs from 'fs/promises';
import { config } from 'dotenv'; 
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
config();

// --- Configuration ---
const SOURCE_DATA_FILE = 'islands_data.json';
const SUPABASE_TABLE_NAME = 'island_chunks';
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY; 

// --- Validate Credentials ---
if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error("ERROR: Missing required environment variables (OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY/SUPABASE_SERVICE_KEY) in .env file.");
    process.exit(1); 
}

// --- Initialize Clients ---
const openaiEmbeddings = new OpenAIEmbeddings({
    openAIApiKey: OPENAI_API_KEY,
    modelName: "text-embedding-ada-002",
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Main Processing Function ---
async function processAndEmbedData() {
    console.log('Starting data processing...');

    // 1. Load Data
    let islands = [];
    try {
        const data = await fs.readFile(SOURCE_DATA_FILE, 'utf-8');
        islands = JSON.parse(data);
        console.log(`Loaded ${islands.length} island descriptions from ${SOURCE_DATA_FILE}.`);
    } catch (error) {
        console.error(`Error loading data from ${SOURCE_DATA_FILE}:`, error.message);
        return;
    }

    // 2. Initialize Text Splitter
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: CHUNK_SIZE,
        chunkOverlap: CHUNK_OVERLAP,
    });

    // 3. Process each island
    let totalChunksCreated = 0;
    let totalChunksStored = 0;
    for (const island of islands) {
        console.log(`--- Processing: ${island.destination} ---`);
        if (!island.description || typeof island.description !== 'string') {
            console.warn(`  Skipping ${island.destination} due to missing or invalid description.`);
            continue;
        }

        // 4. Chunk Description
        const chunks = await splitter.splitText(island.description);
        console.log(`  Split into ${chunks.length} chunks.`);
        totalChunksCreated += chunks.length;

        // 5. Prepare data for Supabase insertion
        const chunksToInsert = [];
        for (const chunkText of chunks) {
            try {
                // 6. Generate Embedding
                const embedding = await openaiEmbeddings.embedQuery(chunkText);
                chunksToInsert.push({
                    destination: island.destination,
                    chunk_text: chunkText,
                    embedding: embedding,
                });
                 // Optional delay to help avoid rate limits
                 // await new Promise(resolve => setTimeout(resolve, 50));
            } catch (embedError) {
                console.error(`    Error embedding chunk for ${island.destination}:`, embedError.message);
            }
        }

        // 7. Store in Supabase
        if (chunksToInsert.length > 0) {
            console.log(`  Storing ${chunksToInsert.length} chunks in Supabase...`);
            const { error: insertError } = await supabase
                .from(SUPABASE_TABLE_NAME)
                .insert(chunksToInsert);
            if (insertError) {
                console.error(`  Error inserting chunks for ${island.destination}: ${insertError.message} (Code: ${insertError.code})`);
                console.error("  Details:", insertError.details); 
            } else {
                console.log(`  Successfully stored ${chunksToInsert.length} chunks for ${island.destination}.`);
                totalChunksStored += chunksToInsert.length;
            }
        } else {
             console.log(`  No valid chunks generated or embedded for ${island.destination} to store.`);
        }
    }
    console.log(`--- Processing Complete ---`);
    console.log(`Total chunks created: ${totalChunksCreated}`);
    console.log(`Total chunks successfully stored: ${totalChunksStored}`);
}

processAndEmbedData().catch(error => {
    console.error("An unexpected error occurred during script execution:", error.message);
    process.exit(1);
});