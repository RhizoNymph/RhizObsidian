import { App, Modal, Notice, request, TFile } from 'obsidian';
import RhizObsidian from '../main';
import { parseString } from 'xml2js';

import { transcribeAudio } from '../util/whisper';

interface Episode {
    number: string;
    title: string;
    mp3Url: string;
    pubDate: string;
}

export class EpisodeListModal extends Modal {
    plugin: RhizObsidian;
    episodes: Episode[] = [];

    constructor(app: App, plugin: RhizObsidian) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h1', { text: 'Revolutions Podcast Episodes' });

        await this.fetchEpisodes();

        this.episodes.forEach(episode => {
            const episodeContainer = contentEl.createEl('div', { cls: 'episode-container' });
            const processButton = episodeContainer.createEl('button', { text: 'Process Episode' });
            episodeContainer.createEl('span', { text: episode.title });  // Changed this line

            processButton.addEventListener('click', async () => {
                await this.processEpisode(episode);
            });
        });
    }

    async fetchEpisodes() {
        const url = 'https://revolutionspodcast.libsyn.com/rss/';
        try {
            const xml = await request({ url });
            const result = await this.parseXml(xml);
            this.episodes = this.extractEpisodes(result);
        } catch (error) {
            console.error('Failed to fetch episodes:', error);
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            new Notice('Failed to fetch episodes.');
        }
    }

    parseXml(xml: string): Promise<any> {
        return new Promise((resolve, reject) => {
            parseString(xml, (err: Error | null, result: any) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }

    extractEpisodes(result: any): Episode[] {
        if (!result.rss || !result.rss.channel || !Array.isArray(result.rss.channel)) {
            console.error('Unexpected RSS structure:', result);
            return [];
        }

        const channel = result.rss.channel[0];
        if (!channel.item || !Array.isArray(channel.item)) {
            console.error('No items found in the channel:', channel);
            return [];
        }

        return channel.item.map((item: any, index: number) => {

            let rawTitle = item.title ? item.title[0] : 'Unknown Title';

            let title = rawTitle.replace(/^\d+:\s*/, '').trim();

            const episode: Episode = {
                number: item['itunes:episode'] ? item['itunes:episode'][0] : (channel.item.length - index).toString(),
                title: title,
                mp3Url: '',
                pubDate: item.pubDate ? item.pubDate[0] : ''
            };

            if (item.enclosure && Array.isArray(item.enclosure) && item.enclosure[0] && item.enclosure[0].$) {
                episode.mp3Url = item.enclosure[0].$.url;
            }

            return episode;
        });
    }

    async processEpisode(episode: Episode) {
        console.log(`Starting to process episode: ${episode.title}`);
        new Notice(`Processing episode: ${episode.title}`);

        // Sanitize the title for use in filenames
        const sanitizedTitle = this.sanitizeFilename(episode.title);
        console.log(`Sanitized title: ${sanitizedTitle}`);

        // Define base paths
        const mp3BasePath = 'Podcasts/Revolutions';
        const transcriptBasePath = 'Podcasts/Revolutions';

        // Ensure directories exist
        console.log('Ensuring directories exist...');
        await this.ensureDirectoryExists(mp3BasePath);
        await this.ensureDirectoryExists(transcriptBasePath);
        console.log('Directories ensured');

        // Download MP3
        const mp3Path = `${mp3BasePath}/${sanitizedTitle}.mp3`;
        console.log(`Downloading MP3 to: ${mp3Path}`);
        await this.downloadFile(episode.mp3Url, mp3Path);
        console.log('MP3 downloaded successfully');

        // Transcribe
        const transcriptPath = `${transcriptBasePath}/${sanitizedTitle}.md`;
        console.log(`Starting transcription. Output path: ${transcriptPath}`);
        try {
            const transcriptionResult = await transcribeAudio(this.app, mp3Path, {
                modelSize: 'large',
                chunkLength: 60,
                temperature: 0.2
            });
            console.log('Transcription completed');

            // Create markdown file with transcription
            if (transcriptionResult) {
                const markdownContent = `# ${episode.title}\n\n${transcriptionResult}`;
                await this.app.vault.create(transcriptPath, markdownContent);
                console.log(`Markdown file created at: ${transcriptPath}`);
            } else {
                console.error('Transcription result is empty or undefined');
            }
        } catch (error) {
            console.error('Error during transcription:', error);
            new Notice(`Failed to transcribe episode: ${error.message}`);
        }

        new Notice(`Finished processing episode: ${episode.title}`);
    }

    async downloadFile(url: string, filePath: string) {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        await this.app.vault.adapter.writeBinary(filePath, buffer);
    }

    sanitizeFilename(filename: string): string {
        return filename.replace(/[\\/:*?"<>|]/g, '-');
    }

    async ensureDirectoryExists(path: string): Promise<void> {
        const dirs = path.split('/');
        let currentPath = '';

        for (const dir of dirs) {
            currentPath += dir + '/';
            if (!(await this.app.vault.adapter.exists(currentPath))) {
                await this.app.vault.createFolder(currentPath);
            }
        }
    }
}
