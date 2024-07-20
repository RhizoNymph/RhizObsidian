import { App, Modal } from 'obsidian';
import { EpisodeListModal } from './zk';
import RhizObsidian from '../main';

export class PodcastSelectionModal extends Modal {
    plugin: RhizObsidian;

    constructor(app: App, plugin: RhizObsidian) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h1', { text: 'Select Podcast Source' });

        const zkButton = contentEl.createEl('button', { text: 'ZK Podcasts' });
        zkButton.onclick = () => {
            new EpisodeListModal(this.app, this.plugin).open();
            this.close();
        };

    }
}