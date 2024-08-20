import { App, Plugin, Modal } from 'obsidian';
import { PodcastSelectionModal } from './podcasts/modal';
import { PaperSelectionModal } from './papers/modal';
import { BookSelectionModal } from './books/modal';
import { extractPDFToMarkdown } from './util/pdf';

export class MainSelectionModal extends Modal {
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
            new PodcastSelectionModal(this.app, this.plugin).open();
            this.close();
        };

        const papersButton = contentEl.createEl('button', { text: 'Papers' });
        papersButton.onclick = () => {
            new PaperSelectionModal(this.app, this.plugin).open();
            this.close();
        };

        const booksButton = contentEl.createEl('button', { text: 'Books' });
        booksButton.onclick = () => {
            new BookSelectionModal(this.app, this.plugin).open();
            this.close();
        };
    }
}

export default class RhizObsidian extends Plugin {
    categories: { id: string; name: string }[]; 
    
    async onload() {
        this.addCommand({
            id: 'open-rhizobsidian-modal',
            name: 'Open RhizObsidian Modal',
            hotkeys: [{ modifiers: ["Ctrl"], key: "R" }],
            callback: () => {
                new MainSelectionModal(this.app, this).open();
            }
        });
        this.addCommand({
            id: 'extract-pdf-to-markdown',
            name: 'Extract PDF to Markdown',
            callback: () => extractPDFToMarkdown(this.app)
        });
        this.addRibbonIcon('dice', 'RhizObsidian', () => {
            new MainSelectionModal(this.app, this).open();
        });
    }
}
