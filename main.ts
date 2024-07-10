import { App, Plugin, Modal, Notice, request } from 'obsidian';

interface EpisodeData {
    title: string;
    transcriptLink: string;
}

interface Episode {
    number: string;
    title: string;
}

class EpisodeListModal extends Modal {
    plugin: RhizObsidian;
    pageNumber: number = 1;
    episodes: Episode[] = [];

    constructor(app: App, plugin: RhizObsidian) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h1', { text: 'Select an Episode' });

        await this.fetchEpisodes();

        this.episodes.forEach(episode => {
            
            const episodeContainer = contentEl.createEl('div', { cls: 'episode-container' });
            const indexButton = episodeContainer.createEl('button', { text: 'Index Episode' });
            episodeContainer.createEl('span', { text: `${episode.number}: ${episode.title}` });
            
            indexButton.addEventListener('click', async () => {
                // Close the modal when an episode is selected for indexing
                this.close();
                // Fetch and create note for the selected episode
                await this.plugin.fetchAndCreateNote(episode.number);
            });
        });

        this.addPagination(contentEl);
    }

    addPagination(contentEl: HTMLElement) {
        const pagination = contentEl.createEl('div', { cls: 'pagination' });
        const prevButton = pagination.createEl('button', { text: 'Previous' });
        const nextButton = pagination.createEl('button', { text: 'Next' });

        prevButton.onclick = async () => {
            if (this.pageNumber > 1) {
                this.pageNumber--;
                await this.onOpen();
            }
        };

        nextButton.onclick = async () => {
            this.pageNumber++;
            await this.onOpen();
        };
    }

    async fetchEpisodes() {
        const url = `https://zeroknowledge.fm/episodes/${this.pageNumber}`;
        try {
            const html = await request({ url });
            const doc = (new DOMParser()).parseFromString(html, 'text/html');
            // Map elements to Episode or null, then filter out null values
            this.episodes = Array.from(doc.querySelectorAll('h3')).map(element => {
                const title = element.textContent?.trim().replace(/\s\s+/g, ' ') ?? '';
                const match = title.match(/Episode (\d+):/);
                if (match) {
                    return { number: match[1], title: title.replace(`Episode ${match[1]}: `, '').replace(' - ZK Podcast', '') };
                }
                return null;
            }).filter(ep => ep !== null) as Episode[]; // Cast to Episode[] after filtering out nulls
        } catch (error) {
            console.error('Failed to fetch episodes:', error);
            new Notice('Failed to fetch episodes.');
        }
    }
}

class MainSelectionModal extends Modal {
    plugin: RhizObsidian;

    constructor(app: App, plugin: RhizObsidian) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h1', { text: 'Select Content Type' });

        const podcastsButton = contentEl.createEl('button', { text: 'Podcasts' });
        podcastsButton.onclick = () => {
            new EpisodeListModal(this.app, this.plugin).open();
        };

        const papersButton = contentEl.createEl('button', { text: 'Papers' });
        papersButton.onclick = () => {
            new ArxivSearchModal(this.app, this.plugin).open();
        };
    }
}

class ArxivSearchModal extends Modal {
    plugin: RhizObsidian;

    constructor(app: App, plugin: RhizObsidian) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h1', { text: 'Search Arxiv Papers' });

        const searchInput = contentEl.createEl('input', { type: 'text' });
        const searchButton = contentEl.createEl('button', { text: 'Search' });

        // Function to handle search
        const handleSearch = async () => {
            const query = encodeURIComponent(searchInput.value);
            await this.performSearch(query, 0);
        };

        // Event listener for the search button
        searchButton.onclick = handleSearch;

        // Event listener for the Enter key in the search input
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                handleSearch();
            }
        });
    }

    async performSearch(query: string, start: number) {
        const url = `https://export.arxiv.org/api/query?search_query=${query}&start=${start}&max_results=5&sortBy=relevance&sortOrder=ascending`;
        try {
            const response = await request({ url });
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(response, "text/xml");
            const entries = Array.from(xmlDoc.querySelectorAll("entry")).map(entry => {
                return {
                    title: entry.querySelector("title")?.textContent,
                    summary: entry.querySelector("summary")?.textContent,   
                    id: entry.querySelector("id")?.textContent,
                    authors: Array.from(entry.querySelectorAll("author")).map(author => author.querySelector("name")?.textContent),
                    published: entry.querySelector("published")?.textContent,                    
                    categories: Array.from(entry.querySelectorAll("category")).map(category => category.getAttribute("term"))
                }
            });
            
            // Try different ways to get the total results
            let totalResults = 0;
            const totalResultsElement = xmlDoc.querySelector("opensearch\\:totalResults, totalResults");
            if (totalResultsElement) {
                totalResults = parseInt(totalResultsElement.textContent || "0");
            } else {
                // If we can't find the element, count the entries
                const allEntries = xmlDoc.querySelectorAll("entry");
                totalResults = allEntries.length;
            }                                                
            new SearchResultsModal(this.app, this.plugin, entries, query, start, totalResults).open();
        } catch (error) {
            console.error('Failed to fetch papers:', error);
            new Notice('Failed to fetch papers.');
        }
    }
}

class SearchResultsModal extends Modal {
    plugin: RhizObsidian;
    results: any[];
    query: string;
    start: number;
    totalResults: number;

    constructor(app: App, plugin: RhizObsidian, results: any[], query: string, start: number, totalResults: number) {
        super(app);
        this.plugin = plugin;
        this.results = results;
        this.query = query;
        this.start = start;
        this.totalResults = totalResults;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h1', { text: 'Search Results' });

        this.results.forEach(result => {
            const resultEl = contentEl.createEl('div', { cls: 'search-result' });
            const titleEl = resultEl.createEl('h2', { text: result.title });
            const authorsEl = resultEl.createEl('p', { text: result.authors.join(', ') });
            const publishedEl = resultEl.createEl('p', { text: result.published });
            const categoriesEl = resultEl.createEl('p', { text: result.categories.join(', ') });
            
            // Create a collapsible container for the summary
            const summaryContainer = resultEl.createEl('div', { cls: 'summary-container' });
            const summaryToggle = summaryContainer.createEl('button', { text: 'Show Summary', cls: 'summary-toggle' });
            const summaryContent = summaryContainer.createEl('p', { text: result.summary, cls: 'summary-content hidden' });

            // Toggle summary visibility
            summaryToggle.onclick = () => {
                summaryContent.classList.toggle('hidden');
                summaryToggle.textContent = summaryContent.classList.contains('hidden') ? 'Show Summary' : 'Hide Summary';
            };

            const createNoteButton = resultEl.createEl('button', { text: 'Create Note' });
            createNoteButton.onclick = async () => {
                await this.plugin.createNoteAndDownloadPDF(result);
            };
        });

        this.addPagination(contentEl);
        this.addStyle();
    }

    addPagination(contentEl: HTMLElement) {
        const pagination = contentEl.createEl('div', { cls: 'pagination' });
        const prevButton = pagination.createEl('button', { text: 'Previous' });
        const nextButton = pagination.createEl('button', { text: 'Next' });
        
        let pageInfoText;
        if (this.totalResults > 0) {
            pageInfoText = `Showing ${this.start + 1}-${Math.min(this.start + this.results.length, this.totalResults)} of ${this.totalResults}`;
        } else {
            pageInfoText = `Showing ${this.start + 1}-${this.start + this.results.length}`;
        }
        const pageInfo = pagination.createEl('span', { text: pageInfoText });

        prevButton.onclick = async () => {
            if (this.start > 0) {
                this.close();
                await new ArxivSearchModal(this.app, this.plugin).performSearch(this.query, Math.max(0, this.start - 5));
            }
        };

        nextButton.onclick = async () => {
            if (this.results.length === 5) {  // If we have a full page, there might be more
                this.close();
                await new ArxivSearchModal(this.app, this.plugin).performSearch(this.query, this.start + 5);
            }
        };

        prevButton.disabled = this.start === 0;
        nextButton.disabled = this.results.length < 5;  // Disable next if we don't have a full page
    }

    addStyle() {
        const style = document.createElement('style');
        style.textContent = `
            .search-result {
                margin-bottom: 20px;
            }
            .summary-container {
                margin-top: 10px;
            }
            .summary-toggle {
                margin-bottom: 5px;
            }
            .summary-content {
                margin-left: 20px;
            }
            .hidden {
                display: none;
            }
            .pagination {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 20px;
            }
            .pagination button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        `;
        document.head.appendChild(style);
    }
}

export default class RhizObsidian extends Plugin {
    async onload() {
        this.addRibbonIcon('dice', 'RhizObsidian', () => {
            new MainSelectionModal(this.app, this).open();
        });
    }

    async fetchAndCreateNote(episodeNumber: string) {
        const url = `https://zeroknowledge.fm/${episodeNumber}-2/`;
        try {
            const html = await request({ url });
            const episodeData = await this.parseEpisodeData(html);
            if (episodeData.transcriptLink.startsWith('http')) {
                const transcript = await request({ url: episodeData.transcriptLink });
                this.createNote(episodeNumber, episodeData.title, transcript);
            } else {
                new Notice('Transcript link is invalid.');
            }
        } catch (error) {
            new Notice('Failed to fetch episode data.');
        }
    }

    async parseEpisodeData(html: string): Promise<EpisodeData> {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const title = doc.querySelector('title')?.textContent || 'Unknown Title';
        const iframeSrc = doc.querySelector('iframe')?.getAttribute('src');
    
        if (iframeSrc) {
            // Ensure the iframeSrc is a complete URL
            const fullIframeSrc = iframeSrc.startsWith('http') ? iframeSrc : `https://${iframeSrc}`;
            

            try {
                const iframeHtml = await request({ url: fullIframeSrc });
                const iframeDoc = parser.parseFromString(iframeHtml, 'text/html');
                const transcriptLink = iframeDoc.querySelector('a.btn[href$=".txt"]')?.getAttribute('href') || 'No transcript available';
                return { title, transcriptLink };
            } catch (error) {
                console.error('Failed to fetch iframe content:', error);
                return { title, transcriptLink: 'No transcript available due to error' };
            }
        } else {
            
            return { title, transcriptLink: 'No transcript available' };
        }
    }

    async createNote(episodeNumber: string, title: string, transcript: string) {
        // Sanitize the title to remove any characters that are not allowed in file names
        const sanitizedTitle = title.replace(/[\\/:*?"<>|]/g, '-');

        const dirPath = 'Sources/Podcasts/ZK Podcast/Episodes';
        const fileName = `${dirPath}/${episodeNumber} - ${sanitizedTitle}.md`;

        // Ensure the directory exists before creating the file
        if (!this.app.vault.adapter.exists(dirPath)) {
            await this.app.vault.createFolder(dirPath);
        }

        this.app.vault.create(fileName, transcript).catch(err => {
            console.error('Error creating note:', err);
            new Notice('Error creating note.');
        });
    }

    async createNoteAndDownloadPDF(result: any) {        
        const sanitizedTitle = result.title.replace(/[\\/:*?"<>|]/g, '-');
        const dirPath = `Sources/Papers/${sanitizedTitle}`;
        const filePath = `${dirPath}/${sanitizedTitle}.md`;

        // Ensure the directory exists before creating the file
        await this.app.vault.createFolder(dirPath).catch(err => console.error('Error creating folder:', err));

        // Create the note with the summary
        await this.app.vault.create(filePath, result.summary).catch(err => {
            console.error('Error creating note:', err);
            new Notice('Error creating note.');
        });

        const pdfUrl = result.id.replace('abs', 'pdf');
        
        try {
            const response = await fetch(pdfUrl);
            if (!response.ok) throw new Error('Failed to fetch PDF');
            const pdfBlob = await response.blob();
            const arrayBuffer = await pdfBlob.arrayBuffer();
            await this.app.vault.createBinary(`${dirPath}/${sanitizedTitle}.pdf`, arrayBuffer);
            
            new Notice('PDF downloaded successfully');
        } catch (error) {
            console.error('Failed to download PDF:', error);
            new Notice('Failed to download PDF.');
        }
    }
}
