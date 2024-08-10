import { App, Modal, Notice, request, TFile } from 'obsidian';
import RhizObsidian from '../main';
import * as cheerio from 'cheerio';

interface ScholarResult {
    title: string;
    url: string;
    authors: string[];
    year: number;
    numCitations: number;
    description: string;
    pdf?: string;
    citationUrl: string;
    relatedUrl: string;
    urlVersionsList: string;
    publication: string;
}
export class ScholarSearchModal extends Modal {
    plugin: RhizObsidian;

    constructor(app: App, plugin: RhizObsidian) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        
        contentEl.empty();
        contentEl.createEl('h1', { text: 'Search Google Scholar' });

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
            const url = `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`;
            const response = await request({ url });
            console.log('Raw HTML response:', response); // Add this line
            const results = this.parseScholarResults(response);
            new SearchResultsModal(this.app, this.plugin, results).open();
        } catch (error) {
            console.error('Failed to fetch papers:', error);
            new Notice('Failed to fetch papers.');
        }
    }

    parseScholarResults(html: string): ScholarResult[] {
        const $ = cheerio.load(html);
        const results: ScholarResult[] = [];

        $('.gs_r.gs_or.gs_scl').each((index, element) => {
            const $element = $(element);
            
            let title = $element.find('.gs_rt').text().trim();
            
            // Remove all [PDF], [BOOK], etc. from the start of the title
            title = title.replace(/^(\s*\[(?:PDF|BOOK|B|CITATION|HTML)\]\s*)+/i, '');
            
            // If the title is empty, try to get it from the anchor tag
            if (!title) {
                title = $element.find('.gs_rt a').text().trim();
            }

            const url = $element.find('.gs_rt a').attr('href') || '';
            const description = $element.find('.gs_rs').text().trim();
            const numCitations = parseInt($element.find('a:contains("Cited by")').text().replace('Cited by ', '')) || 0;
            const pdf = $element.find('.gs_or_ggsm a[href$=".pdf"]').attr('href') || undefined;

            const metaInfo = $element.find('.gs_a').text();
            const authors = metaInfo.split('-')[0].trim().split(',').map(author => author.trim());
            
            // New year extraction logic
            const yearMatch = metaInfo.match(/\b(19|20)\d{2}\b/);
            const year = yearMatch ? parseInt(yearMatch[0]) : 0;

            const publication = metaInfo.split('-').slice(1).join('-').trim();

            const citationUrl = $element.find('a:contains("Cited by")').attr('href') || '';
            const relatedUrl = $element.find('a:contains("Related articles")').attr('href') || '';
            const urlVersionsList = $element.find('a:contains("All "):contains("versions")').attr('href') || '';

            results.push({
                title,
                url,
                authors,
                year,
                numCitations,
                description,
                pdf,
                citationUrl,
                relatedUrl,
                urlVersionsList,
                publication,
            });
        });

        return results;
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
        contentEl.createEl('h1', { text: 'Scholar Search Results' });

        this.results.forEach(result => {
            const resultEl = contentEl.createEl('div', { cls: 'search-result' });
            const titleEl = resultEl.createEl('h2', { text: result.title });
            const authorsEl = resultEl.createEl('p', { text: result.authors.join(', ') });
            const yearEl = resultEl.createEl('p', { text: `Published: ${result.year}` });
            const citationsEl = resultEl.createEl('p', { text: `Citations: ${result.numCitations}` });
            const summaryEl = resultEl.createEl('p', { text: result.description });            

            if (result.pdf) {
                const pdfButton = resultEl.createEl('button', { text: 'Create Note & Download PDF' });
                pdfButton.onclick = async () => {
                    await this.createNoteAndDownloadPDF(result);
                };
            }
        });

        this.addStyle();
    }

    addStyle() {
        const style = document.createElement('style');
        style.textContent = `
            .search-result {
                margin-bottom: 20px;
            }
            .search-result h2 {
                margin-bottom: 5px;
            }
            .search-result p {
                margin: 5px 0;
            }
            .search-result button {
                margin-right: 10px;
            }
        `;
        document.head.appendChild(style);
    }

    async createNoteAndDownloadPDF(result: any) {
        const sanitizedTitle = result.title.replace(/[\\/:*?"<>|]/g, '-');
        const dirPath = `Sources/Papers/`;
        const abstractFilePath = `${dirPath}/Abstracts/${sanitizedTitle}.md`;
        const pdfFilePath = `${dirPath}/PDFs/${sanitizedTitle}.pdf`;

        // Ensure the directory exists before creating the file
        await this.app.vault.createFolder(dirPath).catch(err => console.error('Error creating folder:', err));

        // Create the note with only the abstract
        const noteContent = `# ${result.title}

${result.description}

[PDF](${result.pdf})
`;

        await this.app.vault.create(abstractFilePath, noteContent).catch(err => {
            console.error('Error creating note:', err);
            new Notice('Error creating note.');
            return;
        });

        new Notice('Abstract note created successfully');

        if (result.pdf) {
            try {
                const response = await fetch(result.pdf);
                if (!response.ok) throw new Error('Failed to fetch PDF');
                const pdfBlob = await response.blob();
                const arrayBuffer = await pdfBlob.arrayBuffer();
                await this.app.vault.createBinary(pdfFilePath, arrayBuffer);
                new Notice('PDF downloaded successfully');
            } catch (error) {
                console.error('Failed to download PDF:', error);
                new Notice('Failed to download PDF.');
            }
        }
    }
}

export function searchAndOpenModal(app: App, plugin: RhizObsidian) {
    new ScholarSearchModal(app, plugin).open();
}

