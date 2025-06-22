# 🌴Island Holiday Recommendation App

Island Explorer is a proof-of-concept application ultizing Retrieval-Augmented Generation (RAG) techniques to transform custom data into OpenAI embeddings and using Supabase to store the chunked data. 

Users can then use a form to query the data and return tailored responses.

In our application example we have used data about islands as an example and allowing users to query that information via the form to return suggestions on a match for their query.

## Working Example 
https://next-island-holiday.netlify.app/

## Tech Stack

- **Frontend**: Vanilla JavaScript, CSS, HTML
- **Backend**: Netlify Functions (Serverless)
- **Database**: Supabase (PostgreSQL with vector extensions)
- **AI Services**: OpenAI (Embeddings + GPT-4)
- **Deployment**: Netlify


## How the RAG process works in this app

1. **User submits form** → Frontend sends preferences to API
2. **Query creation** → User preferences converted to search query
3. **Embedding generation** → Query converted to vector using OpenAI
4. **Vector search** → Supabase finds similar content chunks using RPC function
5. **AI generation** → OpenAI generates recommendations based on retrieved chunks
6. **Response** → Formatted recommendations returned to frontend


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

This project is licensed under the [MIT License](LICENSE).
