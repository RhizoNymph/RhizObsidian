import { App, Modal, Notice, request } from 'obsidian';
import RhizObsidian from '../main';

export class ArxivSearchModal extends Modal {
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

        const handleSearch = async () => {
            const query = encodeURIComponent(searchInput.value);
            await this.performSearch(query, 0);
        };

        searchButton.onclick = handleSearch;

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
            
            let totalResults = 0;
            const totalResultsElement = xmlDoc.querySelector("opensearch\\:totalResults, totalResults");
            if (totalResultsElement) {
                totalResults = parseInt(totalResultsElement.textContent || "0");
            } else {
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

            const summaryContainer = resultEl.createEl('div', { cls: 'summary-container' });
            const summaryToggle = summaryContainer.createEl('button', { text: 'Show Summary', cls: 'summary-toggle' });
            const summaryContent = summaryContainer.createEl('p', { text: result.summary, cls: 'summary-content hidden' });

            summaryToggle.onclick = () => {
                summaryContent.classList.toggle('hidden');
                summaryToggle.textContent = summaryContent.classList.contains('hidden') ? 'Show Summary' : 'Hide Summary';
            };

            const createNoteButton = resultEl.createEl('button', { text: 'Create Note' });
            createNoteButton.onclick = async () => {
                await this.createNoteAndDownloadPDF(result);
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

