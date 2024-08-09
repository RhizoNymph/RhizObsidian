import { App, Modal, Notice } from 'obsidian';
import { ArxivSearchModal } from './arxiv';
import { DailyPapersModal } from './huggingface';
import { ScholarSearchModal } from './scholar';

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

        const arxivButton = contentEl.createEl('button', { text: 'arXiv' });
        arxivButton.onclick = () => {
            new ArxivSearchModal(this.app, this.plugin).open();
            this.close();
        };

        const huggingfaceButton = contentEl.createEl('button', { text: 'HuggingFace' });
        huggingfaceButton.onclick = () => {
            new DailyPapersModal(this.app, this.plugin).open();
            this.close();
        };

        const scholarButton = contentEl.createEl('button', { text: 'Google Scholar' });
        scholarButton.onclick = () => {
            new ScholarSearchModal(this.app, this.plugin).open();
        };
    }
}
