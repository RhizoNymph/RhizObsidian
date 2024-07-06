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

export default class RhizObsidian extends Plugin {
    async onload() {
        this.addRibbonIcon('dice', 'ZK Podcast', () => {
            new EpisodeListModal(this.app, this).open();
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
            console.log(`Fetching iframe from: ${fullIframeSrc}`);

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
            console.log('No iframe found in the HTML.');
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
}
