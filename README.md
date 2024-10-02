# RhizObsidian

This is a plugin for whatever I want to do in obsidian because splitting functionalities seems like a fool's errand.


To install, clone this into your obsidian vaults .plugins directory and run 'npm install && npm run dev'. This builds the plugin so that obsidian can use it. AFTER doing that, start obsidian. If you're on nix, run 'nix develop' first.


If you're using any of the RAG or LLM functionality you need to run 'python3 -m venv venv && . venv/bin/activate' (venv\Scripts\activate on Windows). Then add your anthropic api key in the flask-server.py. Then run 'python3 flask-server.py'. I usually run this in a tmux session on my desktop and leave it up. If you want to run it somewhere not your local machine change 'localhost' in main.ts to the host where you want to run it. I recommend running it somewhere with a GPU, it does PDF indexing and Top K page searching with CUDA.


After doing that, you can use Ctrl+P to bring up the command palette in obsidian and type PDF. This will give you 'index current PDF' that indexes your current active file if its a PDF that hasn't been indexed before and 'index all PDFs' will index all of the PDFs in your vault. This can take a while but I was able to index ~100 pdfs with a total of ~4k pages on a 3090 in like 5-8 hours (idk don't quote me on this).


Once you have indexed PDFs, any message sent to Claude (Click the speech bubble in the left sidebar) will first search the index for the top 10 pages and present you with a search results modal where you can uncheck any pages that don't look relevant. When you click submit, it will send your prompt along with all the checked pages to Claude and get you a response. It might not look like it works if you have slow internet but it does, I haven't added waiting indicators yet. I also haven't tweaked the top K number, but you can in the flask file.


Warning: This doesn't save chats yet. It's very much a WIP but I'm building in public and sending it to some beta testers.

This also has easy indexing of the ZK podcast transcripts, revolutions podcast transcripts, and pdfs of Huggingface daily papers through the dice icon on the left sidebar.
