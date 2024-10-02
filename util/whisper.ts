import { App, TFile, requestUrl } from 'obsidian';

export async function transcribeAudio(app: App, fileOrPath: TFile | string): Promise<string> {
    try {
        let file: TFile;
        if (typeof fileOrPath === 'string') {
            file = app.vault.getAbstractFileByPath(fileOrPath) as TFile;
            if (!file || !(file instanceof TFile)) {
                throw new Error(`No file found at path: ${fileOrPath}`);
            }
        } else {
            file = fileOrPath;
        }

        const arrayBuffer = await app.vault.readBinary(file);

        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });

        const formData = new FormData();
        formData.append('file', blob, file.name);

        const response = await fetch('http://office.lan.cchh.space:5000/transcribe', {
            method: 'POST',
            body: formData,
        });

        const responseText = await response.text();

        if (response.status !== 200) {
            throw new Error(`Server responded with status ${response.status}: ${response.text}`);
        }

        const result = JSON.parse(responseText);

        if (!result.success || !result.transcription) {
            throw new Error('Server did not return expected data');
        }

        return result.transcription;
    } catch (error) {
        console.error('Error during audio transcription:', error);
        throw error;
    }
}

export async function transcribeCurrentFileAndSave(app: App): Promise<void> {
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) {
        new Notice('No active file');
        return;
    }

    try {
        // Check if the file is an audio file (you may want to expand this list)
        const audioExtensions = ['mp3', 'm4a', 'wav', 'ogg'];
        if (!audioExtensions.includes(activeFile.extension.toLowerCase())) {
            new Notice('Current file is not a supported audio file');
            return;
        }

        new Notice('Starting transcription...');

        const transcription = await transcribeAudio(app, activeFile);

        // Create a new markdown file with the transcription
        const newFileName = `${activeFile.basename}_transcription.md`;
        const newFilePath = `${activeFile.parent.path}/${newFileName}`;

        await app.vault.create(newFilePath, transcription);

        new Notice(`Transcription saved as ${newFileName}`);
    } catch (error) {
        console.error('Error in transcribeCurrentFileAndSave:', error);
        new Notice(`Transcription failed: ${error.message}`);
    }
}
