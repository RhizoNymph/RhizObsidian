import { App, Modal, Notice, requestUrl, TFile } from 'obsidian';
import RhizObsidian from '../main';

export class LibgenSearchModal extends Modal {
    plugin: RhizObsidian;

    constructor(app: App, plugin: RhizObsidian) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        
        contentEl.empty();
        contentEl.createEl('h1', { text: 'Search Libgen Books' });

        const searchInput = contentEl.createEl('input', { type: 'text' });
        const searchButton = contentEl.createEl('button', { text: 'Search' });

        const handleSearch = async () => {
            const query = searchInput.value;
            await this.performSearch(query);
        };

        searchButton.onclick = handleSearch;

        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                handleSearch();
            }
        });
    }

    async performSearch(query: string) {
        try {
            // @ts-ignore
            const libgen = require('libgenesis');
            const books = await libgen(query);
            new SearchResultsModal(this.app, this.plugin, books).open();
        } catch (error) {
            console.error('Failed to fetch books:', error);
            new Notice('Failed to fetch books.');
        }
    }
}

class SearchResultsModal extends Modal {
    plugin: RhizObsidian;
    results: any[];

    constructor(app: App, plugin: RhizObsidian, results: any[]) {
        super(app);
        this.plugin = plugin;
        this.results = results;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h1', { text: 'Search Results' });

        this.results.forEach(result => {
            const resultEl = contentEl.createEl('div', { cls: 'search-result' });
            resultEl.createEl('h2', { text: result.title });
            resultEl.createEl('p', { text: `Author: ${result.author}` });
            resultEl.createEl('p', { text: `Language: ${result.language}` });
            resultEl.createEl('p', { text: `File size: ${result.filesize}` });
            resultEl.createEl('p', { text: `Format: ${result.extension}` });

            const downloadButton = resultEl.createEl('button', { text: 'Download' });
            downloadButton.onclick = async () => {
                await this.downloadBook(result);
            };
        });

        this.addStyle();
    }

    addStyle() {
        const style = document.createElement('style');
        style.textContent = `
            .search-result {
                margin-bottom: 20px;
                padding: 10px;
                border: 1px solid #ccc;
                border-radius: 5px;
            }
            .search-result h2 {
                margin-top: 0;
            }
            .search-result button {
                margin-top: 10px;
            }
        `;
        document.head.appendChild(style);
    }

    async downloadBook(book: any) {
        const sanitizedTitle = book.title.replace(/[\\/:*?"<>|]/g, '-');
        const dirPath = `Sources/Books/`;
        const filePath = `${dirPath}/${sanitizedTitle}.${book.extension}`;

        try {
            await this.app.vault.createFolder(dirPath);
        } catch (error) {
            console.error('Failed to create folder:', error);
            new Notice('Failed to create folder for download.');
            return;
        }
        
        const maxRetries = 3;
        let retries = 0;

        while (retries < maxRetries) {
            try {
                console.log(`Attempt ${retries + 1} to download from URL:`, book.download);
                
                const response = await requestUrl({
                    url: book.download,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    },
                    throw: false
                });

                if (response.status !== 200) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                if (!response.arrayBuffer) {
                    throw new Error('Response does not contain arrayBuffer');
                }

                await this.app.vault.createBinary(filePath, response.arrayBuffer);
                
                new Notice('Book downloaded successfully');
                return;
            } catch (error) {
                console.error(`Attempt ${retries + 1} failed:`, error);
                retries++;
                if (retries >= maxRetries) {
                    console.error('Failed to download book after multiple attempts:', error);
                    new Notice(`Failed to download book: ${error.message}`);
                } else {
                    await new Promise(resolve => setTimeout(resolve, 2000 * retries)); // Wait before retrying
                }
            }
        }
    }
}
