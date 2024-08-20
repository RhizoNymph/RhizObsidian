import { App, Modal, Notice } from 'obsidian';
import { LibgenSearchModal } from './libgen';

import RhizObsidian from '../main';

export class BookSelectionModal extends Modal {
    plugin: RhizObsidian;

    constructor(app: App, plugin: RhizObsidian) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h1', { text: 'Select Book Source' });

        const arxivButton = contentEl.createEl('button', { text: 'Libgen' });
        arxivButton.onclick = () => {
            new LibgenSearchModal(this.app, this.plugin).open();
            this.close();
        };
    }
}
