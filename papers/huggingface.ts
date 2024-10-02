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

                const downloadRenameButton = paperEl.createEl('button', { text: 'Download and Rename' });
                downloadRenameButton.onclick = async () => {
                    try {
                        console.log("Starting download and rename process"); // Debug log
                        const newName = await this.promptForNewName(paper.title);
                        console.log("New name received:", newName); // Debug log
                        if (newName) {
                            console.log("Proceeding with download using new name:", newName); // Debug log
                            await this.downloadPaperAndCreateNote(paper, newName);
                        } else {
                            console.log("Download cancelled: No new name provided");
                            new Notice("Download cancelled: No new name provided");
                        }
                    } catch (error) {
                        console.error("Error in download and rename process:", error);
                        new Notice("Error in download and rename process");
                    }
                };
            });
        }).catch(error => {
            new Notice('Failed to fetch papers.');
            console.error('Error fetching papers:', error);
        });
    }

    async downloadPaperAndCreateNote(paper: Paper, customName?: string) {
        console.log("Downloading paper:", paper.title);
        console.log("Custom name:", customName);

        const sanitizedTitle = customName
            ? customName.replace(/[\\/:*?"<>|]/g, '-')
            : paper.title.replace(/[\\/:*?"<>|]/g, '-');
        console.log("Sanitized title:", sanitizedTitle);

        const dirPath = `Papers`;
        const pdfPath = `${dirPath}/${sanitizedTitle}.pdf`;

        try {
          // Ensure the directory exists before creating the file
          await this.app.vault.createFolder(dirPath);
        } catch(error) {
          console.log("Directory already exists.")
        }

        try {
            const pdfUrl = `https://arxiv.org/pdf/${paper.id}.pdf`;
            console.log("Fetching PDF from:", pdfUrl);

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
            await this.app.vault.createBinary(pdfPath, arrayBuffer);
            console.log("PDF file created");

            new Notice('Paper downloaded and renamed successfully');
        } catch (error) {
            console.error('Failed to download or rename paper:', error);
            new Notice('Failed to download or rename paper.');
        }
    }

    async promptForNewName(originalTitle: string): Promise<string | null> {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.titleEl.setText('Enter new name for the paper');

            const inputEl = modal.contentEl.createEl('input', {
                type: 'text',
                value: originalTitle
            });
            inputEl.style.width = '100%';

            const buttonContainer = modal.contentEl.createEl('div');
            buttonContainer.style.display = 'flex';
            buttonContainer.style.justifyContent = 'flex-end';
            buttonContainer.style.marginTop = '10px';

            const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
            const confirmButton = buttonContainer.createEl('button', { text: 'Confirm' });

            let isConfirmed = false;

            const handleConfirm = () => {
                const newName = inputEl.value.trim();
                console.log("Confirming new name:", newName); // Debug log
                isConfirmed = true;
                modal.close();
            };

            cancelButton.onclick = () => {
                console.log("Cancelling rename"); // Debug log
                modal.close();
            };

            confirmButton.onclick = handleConfirm;

            inputEl.focus();
            inputEl.select();

            // Handle Enter key
            inputEl.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    handleConfirm();
                }
            });

            modal.onClose = () => {
                console.log("Modal closed"); // Debug log
                if (isConfirmed) {
                    const newName = inputEl.value.trim();
                    resolve(newName !== '' ? newName : null);
                } else {
                    resolve(null);
                }
            };

            modal.open();
        });
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
