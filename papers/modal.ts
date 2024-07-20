import { App, Modal } from 'obsidian';
import { ArxivSearchModal } from './arxiv';
import RhizObsidian from '../main';

export class PaperSelectionModal extends Modal {
    plugin: RhizObsidian;

    constructor(app: App, plugin: RhizObsidian) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h1', { text: 'Select Paper Source' });

        const arxivButton = contentEl.createEl('button', { text: 'arXiv Papers' });
        arxivButton.onclick = () => {
            new ArxivSearchModal(this.app, this.plugin).open();
            this.close();
        };

    }
}