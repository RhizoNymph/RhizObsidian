import { App, Modal, Notice, request, requestUrl, RequestUrlResponse } from 'obsidian';
import RhizObsidian from '../main';
import { TFile } from 'obsidian';

interface Paper {
    id: string;
    title: string;
    summary: string;
    authors: string[];
    publishedAt: string;
    link: string;
}

export class DailyPapersModal extends Modal {
    plugin: RhizObsidian;
    papers: Paper[] = [];

    constructor(app: App, plugin: RhizObsidian) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h1', { text: 'Hugging Face Daily Papers' });

        this.fetchPapers().then(() => {
            this.papers.forEach(paper => {
                const paperEl = contentEl.createEl('div', { cls: 'paper' });
                paperEl.createEl('h2', { text: paper.title });

                // Create a button to toggle the summary visibility
                const summaryToggle = paperEl.createEl('button', { text: 'Show Summary' });
                const summaryEl = paperEl.createEl('p', { text: paper.summary, cls: 'summary' });
                summaryEl.style.display = 'none'; // Start with the summary collapsed

                // Toggle function for the summary
                summaryToggle.onclick = () => {
                    if (summaryEl.style.display === 'none') {
                        summaryEl.style.display = 'block';
                        summaryToggle.textContent = 'Hide Summary';
                    } else {
                        summaryEl.style.display = 'none';
                        summaryToggle.textContent = 'Show Summary';
                    }
                };

                // Replace the download button code with this:
                const downloadButton = paperEl.createEl('button', { text: 'Download from ArXiv' });
                downloadButton.onclick = async () => {
                    await this.downloadPaperAndCreateNote(paper);
                };
            });
        }).catch(error => {
            new Notice('Failed to fetch papers.');
            console.error('Error fetching papers:', error);
        });
    }

    async downloadPaperAndCreateNote(paper: Paper) {
        const sanitizedTitle = paper.title.replace(/[\\/:*?"<>|]/g, '-');
        const dirPath = `Sources/Papers/`;
        const abstractPath = `${dirPath}/Abstracts/${sanitizedTitle}.md`;

        // Ensure the directory exists before creating the file
        await this.app.vault.createFolder(dirPath).catch(err => console.error('Error creating folder:', err));

        // Create the note with the summary
        await this.app.vault.create(abstractPath, paper.summary).catch(err => {
            console.error('Error creating note:', err);
            new Notice('Error creating note.');
        });

        const pdfUrl = `https://arxiv.org/pdf/${paper.id}.pdf`;
        
        try {
            const response: RequestUrlResponse = await requestUrl({
                url: pdfUrl,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                throw: false
            });

            if (response.status !== 200) {
                throw new Error(`Failed to download PDF: ${response.status}`);
            }

            const arrayBuffer = response.arrayBuffer;
            await this.app.vault.createBinary(`${dirPath}/PDFs/${sanitizedTitle}.pdf`, arrayBuffer);
            
            new Notice('PDF downloaded successfully');
        } catch (error) {
            console.error('Failed to download PDF:', error);
            new Notice('Failed to download PDF.');
        }
    }

    async fetchPapers() {
        const url = 'https://huggingface.co/api/daily_papers'; // Correct API endpoint
        try {
            const response = await request({ url });
            if (!response) {
                throw new Error('No response from the server');
            }
            const data = JSON.parse(response);
            if (!data || !Array.isArray(data)) {
                throw new Error('No papers found in the response');
            }
            this.papers = data.map((item: any) => ({
                id: item.paper.id,
                title: item.paper.title,
                summary: item.paper.summary,
                authors: item.paper.authors.map((author: any) => author.name).join(', '),
                publishedAt: item.paper.publishedAt,
                link: `https://huggingface.co/papers/${item.paper.id}`
            }));
        } catch (error) {
            console.error('Failed to load papers from Hugging Face:', error);
            throw new Error('Failed to load papers from Hugging Face.');
        }
    }
}