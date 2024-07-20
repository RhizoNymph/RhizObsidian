import { App, Plugin, Modal } from 'obsidian';
import { PodcastSelectionModal } from './podcasts/modal';
import { PaperSelectionModal } from './papers/modal';

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
    }
}

export default class RhizObsidian extends Plugin {
    async onload() {
        this.addRibbonIcon('dice', 'RhizObsidian', () => {
            new MainSelectionModal(this.app, this).open();
        });
    }
}