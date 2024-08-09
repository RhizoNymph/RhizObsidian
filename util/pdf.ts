import { App, Plugin, Modal, Notice, TFile } from 'obsidian';
import * as pdfjsLib from 'pdfjs-dist';

// Add this line to set the worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.mjs';

export async function extractPDFToMarkdown(app: App) {
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension !== 'pdf') {
        new Notice('Please open a PDF file first');
        return;
    }

    const pdfData = await this.app.vault.readBinary(activeFile);
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

    let currentChapter = '';
    let chapterContent = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');

        if (pageText.toLowerCase().includes('chapter') || pageText.toLowerCase().includes('part')) {
            if (currentChapter) {
                await this.saveChapterToMarkdown(currentChapter, chapterContent);
            }
            currentChapter = pageText.split('\n')[0].trim();
            chapterContent = '';
        }

        chapterContent += pageText + '\n\n';

        const ops = await page.getOperatorList();
        for (let j = 0; j < ops.fnArray.length; j++) {
            if (ops.fnArray[j] == pdfjsLib.OPS.paintImageXObject) {
                const imgIndex = ops.argsArray[j][0];
                const img = await page.objs.get(imgIndex);
                const imgData = img.data;
                const imgFileName = `${activeFile.basename}_image_${i}_${j}.png`;
                await this.app.vault.createBinary(imgFileName, imgData);
                chapterContent += `![${imgFileName}](${imgFileName})\n\n`;
            }
        }
    }

    if (currentChapter) {
        await saveChapterToMarkdown(currentChapter, chapterContent);
    }

    new Notice('PDF extraction complete');
}

async function saveChapterToMarkdown(chapterTitle: string, content: string) {
    const fileName = `${chapterTitle.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    const fileContent = `# ${chapterTitle}\n\n${content}`;
    await this.app.vault.create(fileName, fileContent);
}