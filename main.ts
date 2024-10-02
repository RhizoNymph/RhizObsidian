import { App, Plugin, Modal, ItemView, TFile, TFolder, TAbstractFile, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { PodcastSelectionModal } from './podcasts/modal';
import { PaperSelectionModal } from './papers/modal';
import { BookSelectionModal } from './books/modal';
import { extractPDFToMarkdown, extractAllPDFsToMarkdown } from './util/pdf';
import { transcribeCurrentFileAndSave } from './util/whisper';

export const LLM_VIEW_TYPE = "llm-chat";

export class LLMView extends ItemView {
    private inputEl: HTMLTextAreaElement;
    private sendButton: HTMLButtonElement;
    private attachButton: HTMLButtonElement;
    private chatContainer: HTMLElement;
    private attachedImage: string | null = null;
    private conversationHistory: any[] = [];

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return LLM_VIEW_TYPE;
    }

    getDisplayText() {
        return "LLM Chat";
    }

    async performSearch(query: string) {
        const response = await fetch("http://localhost:5000/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query }),
        });

        return await response.json();
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl("h4", { text: "LLM Chat" });

        this.chatContainer = container.createEl("div", { cls: "llm-chat-container" });
        this.chatContainer.style.flexGrow = "1";
        this.chatContainer.style.overflowY = "auto";
        this.chatContainer.style.display = "flex";
        this.chatContainer.style.flexDirection = "column";

        const inputContainer = container.createEl("div", { cls: "llm-input-container" });

        this.inputEl = inputContainer.createEl("textarea", {
            attr: { placeholder: "Type your prompt here..." },
            cls: "llm-input"
        });

        const buttonContainer = inputContainer.createEl("div", { cls: "llm-button-container" });

        this.attachButton = buttonContainer.createEl("button", {
            text: "Attach Image",
            cls: "llm-attach-button"
        });

        this.sendButton = buttonContainer.createEl("button", {
            text: "Send",
            cls: "llm-send-button"
        });

        this.attachButton.addEventListener("click", this.handleAttachImage.bind(this));
        this.sendButton.addEventListener("click", this.handleSend.bind(this));

        // Add some basic styles
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.height = "100%";
        inputContainer.style.marginTop = "auto";

        this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });
    }

    async handleAttachImage() {
        // Open a file picker dialog
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                this.attachedImage = await this.convertToBase64(file);
                this.attachButton.setText("Image Attached");
                this.attachButton.addClass("image-attached");
            }
        };
        fileInput.click();
    }

    async handleSend() {
        const prompt = this.inputEl.value;
        if (prompt.trim()) {
            console.log("Sending search query:", prompt);
            // Perform search
            const searchResults = await this.performSearch(prompt);
            console.log("Received search results:", searchResults);

            // Open modal with search results
            new SearchResultsModal(this.app, searchResults, (selectedImages, selectedTexts) => {
                console.log("Selected images:", selectedImages);
                console.log("Selected texts:", selectedTexts);

                const messages = [];

                // Add selected images
                selectedImages.forEach(image => {
                    messages.push({
                        type: "image_url",
                        image_url: { url: image.base64 }
                    });
                });

                // Add selected texts
                selectedTexts.forEach(text => {
                    messages.push({
                        type: "text",
                        text: `[From ${text.doc_id}]: ${text.content}`
                    });
                });

                // Add user's prompt
                messages.push({
                    type: "text",
                    text: prompt
                });

                // If there's an attached image, add it
                if (this.attachedImage) {
                    messages.push({
                        type: "image_url",
                        image_url: { url: this.attachedImage }
                    });
                }

                this.sendToLLM(messages).then(response => {
                    const assistantMessage = { role: "assistant", content: response.choices[0].message.content };
                    this.conversationHistory.push(assistantMessage);
                    this.displayMessage(assistantMessage);

                    this.inputEl.value = '';

                    // Reset attached image
                    this.attachedImage = null;
                    this.attachButton.setText("Attach Image");
                    this.attachButton.removeClass("image-attached");
                });
            }).open();
        }
    }

    async sendToLLM(messages: any[]) {
        const response = await fetch("http://localhost:5000/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messages: messages
            }),
        });

        return await response.json();
    }

    displayMessage(message: any) {
        console.log("Displaying message:", message);
        const messageEl = this.chatContainer.createEl("div", { cls: `${message.role}-message` });
        messageEl.createEl("strong", { text: `${message.role === 'user' ? 'You' : 'LLM'}: ` });

        if (message.image) {
            console.log("Displaying attached image");
            this.displayImage(messageEl, message.image);
        }

        if (message.selectedImages) {
            console.log("Displaying selected images:", message.selectedImages);
            message.selectedImages.forEach(img => this.displayImage(messageEl, img.base64));
        }

        if (message.selectedTexts) {
            console.log("Displaying selected texts:", message.selectedTexts);
            message.selectedTexts.forEach(text => {
                messageEl.createEl("p", { text: `Selected Text: ${text.content.substring(0, 100)}...` });
            });
        }

        messageEl.createEl("p", { text: message.content });
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    displayImage(container: HTMLElement, base64Data: string) {
        console.log("Displaying image with base64 data:", base64Data.substring(0, 50) + "...");
        const imageContainer = container.createEl("div", { cls: "attached-image-container" });
        const img = imageContainer.createEl("img", {
            cls: "attached-image",
            attr: { src: `data:image/png;base64,${base64Data}` }
        });
        img.style.maxWidth = "200px";
        img.style.maxHeight = "200px";
        img.onerror = () => console.error("Failed to load image");
        img.onload = () => console.log("Image loaded successfully");
    }

    async convertToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // Remove the MIME type prefix
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }
}

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
    indexedHashes: Set<string> = new Set();

    async indexCurrentFile() {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === 'pdf') {
            await this.indexPDF(activeFile);
        } else {
            new Notice('The current file is not a PDF.');
        }
    }

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
        this.addCommand({
            id: 'extract-all-pdfs-to-markdown',
            name: 'Extract All PDFs in Folder to Markdown',
            callback: () => extractAllPDFsToMarkdown(this.app)
        });
        this.addCommand({
            id: 'transcribe-current-file',
            name: 'Transcribe Current Audio File',
            callback: () => transcribeCurrentFileAndSave(this.app)
        });
        this.addRibbonIcon('dice', 'RhizObsidian', () => {
            new MainSelectionModal(this.app, this).open();
        });

        this.registerView(
            LLM_VIEW_TYPE,
            (leaf: WorkspaceLeaf) => new LLMView(leaf)
        );

        this.addRibbonIcon("message-circle", "LLM Chat", () => {
            this.activateLLMView();
        });

        this.addCommand({
            id: 'index-all-pdfs',
            name: 'Index All PDFs in Vault',
            callback: () => this.indexAllPDFs()
        });

        // Fetch indexed hashes when the plugin loads
        this.fetchIndexedHashes();

        this.addCommand({
            id: 'index-current-pdf',
            name: 'Index Current PDF',
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.extension === 'pdf') {
                    if (!checking) {
                        this.indexCurrentFile();
                    }
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'index-current-markdown',
            name: 'Index Current Markdown File',
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.extension === 'md') {
                    if (!checking) {
                        this.indexMarkdown(activeFile);
                    }
                    return true;
                }
                return false;
            }
        });
    }

    async activateLLMView() {
        const { workspace } = this.app;

        let leaf = workspace.getLeavesOfType(LLM_VIEW_TYPE)[0];

        if (!leaf) {
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: LLM_VIEW_TYPE, active: true });
        }

        workspace.revealLeaf(leaf);
    }

    async fetchIndexedHashes() {
        try {
            const response = await fetch('http://localhost:5000/get_indexed_hashes');
            const hashes = await response.json();
            this.indexedHashes = new Set(hashes);
        } catch (error) {
            console.error('Failed to fetch indexed hashes:', error);
        }
    }

    async handleNewFile(file: TAbstractFile) {
        if (file instanceof TFile && file.extension === 'pdf') {
            await this.indexPDF(file);
        }
    }

    async indexAllPDFs() {
        const files = this.app.vault.getFiles();
        for (const file of files) {
            if (file.extension === 'pdf') {
                await this.indexPDF(file);
            }
        }
    }

    async indexPDF(file: TFile) {
        const fileContent = await this.app.vault.readBinary(file);
        const base64Content = arrayBufferToBase64(fileContent);

        const fileHash = await this.calculateSHA256(fileContent);
        if (this.indexedHashes.has(fileHash)) {
            console.log(`File ${file.name} already indexed.`);
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/indexPDF', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: file.name,
                    pdf_content: base64Content,
                }),
            });

            const result = await response.json();
            console.log(result.message);

            if (response.ok) {
                this.indexedHashes.add(fileHash);
            }
        } catch (error) {
            console.error(`Failed to index PDF ${file.name}:`, error);
        }
    }

    async indexMarkdown(file: TFile) {
        const content = await this.app.vault.read(file);
        try {
            const response = await fetch('http://localhost:5000/indexMarkdown', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: file.name,
                    content: content,
                }),
            });

            const result = await response.json();
            console.log(result.message);

            if (response.ok) {
                new Notice('Markdown indexed successfully');
            }
        } catch (error) {
            console.error(`Failed to index markdown ${file.name}:`, error);
            new Notice('Failed to index markdown');
        }
    }

    async calculateSHA256(arrayBuffer: ArrayBuffer): Promise<string> {
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

class SearchResultsModal extends Modal {
    results: { images: any[], texts: any[] };
    onSubmit: (selectedImages: any[], selectedTexts: any[]) => void;

    constructor(app: App, results: { images: any[], texts: any[] }, onSubmit: (selectedImages: any[], selectedTexts: any[]) => void) {
        super(app);
        this.results = results;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.style.display = 'flex';
        contentEl.style.flexDirection = 'column';
        contentEl.style.height = '80vh';  // Set a fixed height

        // Create fixed header
        const header = contentEl.createDiv({ cls: 'modal-header' });
        header.style.position = 'sticky';
        header.style.top = '0';
        header.style.backgroundColor = 'var(--background-primary)';
        header.style.zIndex = '1';
        header.style.padding = '10px';
        header.style.borderBottom = '1px solid var(--background-modifier-border)';

        header.createEl('h2', { text: 'RAG Results' });

        // Create tab buttons in the header
        const tabContainer = header.createDiv({ cls: 'tab-container' });
        const imagesTabButton = tabContainer.createEl('button', { text: 'Images' });
        const textsTabButton = tabContainer.createEl('button', { text: 'Texts' });

        // Create scrollable content area
        const contentArea = contentEl.createDiv({ cls: 'modal-content' });
        contentArea.style.flex = '1';
        contentArea.style.overflow = 'auto';
        contentArea.style.padding = '10px';

        // Create content containers
        const imagesContent = contentArea.createDiv({ cls: 'tab-content' });
        const textsContent = contentArea.createDiv({ cls: 'tab-content' });

        // Initially hide texts content
        textsContent.style.display = 'none';

        // Tab switching logic
        imagesTabButton.onclick = () => {
            imagesContent.style.display = 'block';
            textsContent.style.display = 'none';
            imagesTabButton.classList.add('active');
            textsTabButton.classList.remove('active');
        };

        textsTabButton.onclick = () => {
            imagesContent.style.display = 'none';
            textsContent.style.display = 'block';
            textsTabButton.classList.add('active');
            imagesTabButton.classList.remove('active');
        };

        // Images content
        this.createImagesContent(imagesContent);

        // Texts content
        this.createTextsContent(textsContent);

        // Create fixed footer
        const footer = contentEl.createDiv({ cls: 'modal-footer' });
        footer.style.position = 'sticky';
        footer.style.bottom = '0';
        footer.style.backgroundColor = 'var(--background-primary)';
        footer.style.zIndex = '1';
        footer.style.padding = '10px';
        footer.style.borderTop = '1px solid var(--background-modifier-border)';

        // Submit button in the footer
        const submitButton = footer.createEl('button', { text: 'Submit' });
        submitButton.style.width = '100%';
        submitButton.onclick = () => {
            const selectedImages = Array.from(imagesContent.querySelectorAll('input[type="checkbox"]:checked'))
                .map((checkbox, index) => this.results.images[index]);
            const selectedTexts = Array.from(textsContent.querySelectorAll('input[type="checkbox"]:checked'))
                .map((checkbox, index) => this.results.texts[index]);
            this.onSubmit(selectedImages, selectedTexts);
            this.close();
        };

        // Activate Images tab by default
        imagesTabButton.click();
    }

    createImagesContent(container: HTMLElement) {
        const imageGrid = container.createDiv({ cls: 'image-grid' });
        imageGrid.style.display = 'grid';
        imageGrid.style.gridTemplateColumns = '1fr';
        imageGrid.style.gap = '15px';

        this.results.images.forEach((image, index) => {
            const wrapper = imageGrid.createDiv({ cls: 'image-wrapper' });
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.alignItems = 'center';

            const checkbox = wrapper.createEl('input', { type: 'checkbox', attr: { checked: true } });
            if (image.base64) {
                const img = wrapper.createEl('img', {
                    attr: {
                        src: `data:image/png;base64,${image.base64}`,
                        style: 'width: 100%; height: auto; max-width: 600px; object-fit: contain;'
                    }
                });
                img.onerror = () => console.error(`Failed to load image ${index}`);
                img.onload = () => console.log(`Image ${index} loaded successfully`);
            } else {
                console.error(`No base64 data for image ${index}`);
                wrapper.createEl('span', { text: 'Image data not available' });
            }
            wrapper.createEl('span', { text: `Image ${index + 1}` });
        });
    }

    createTextsContent(container: HTMLElement) {
        const textGrid = container.createDiv({ cls: 'text-grid' });
        textGrid.style.display = 'grid';
        textGrid.style.gridTemplateColumns = '1fr';
        textGrid.style.gap = '15px';

        this.results.texts.forEach((text, index) => {
            const wrapper = textGrid.createDiv({ cls: 'text-wrapper' });
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.border = '1px solid #ccc';
            wrapper.style.padding = '15px';
            wrapper.style.borderRadius = '5px';

            const checkbox = wrapper.createEl('input', { type: 'checkbox', attr: { checked: true } });
            const textPreview = wrapper.createEl('p', { text: text.content.substring(0, 300) + '...' });
            textPreview.style.margin = '10px 0';
            textPreview.style.lineHeight = '1.4';
            textPreview.style.maxHeight = '150px';
            textPreview.style.overflow = 'auto';

            // Add source information
            const sourceInfo = wrapper.createEl('p', { text: `Source: ${text.doc_id}` });
            sourceInfo.style.fontStyle = 'italic';
            sourceInfo.style.marginTop = '5px';
        });
    }
}
