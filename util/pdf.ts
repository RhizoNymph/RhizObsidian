import { App, Notice, requestUrl, TFile } from 'obsidian';

export async function extractPDFToMarkdown(app: App) {
    const activeFile = app.workspace.getActiveFile();

    if (!activeFile || activeFile.extension !== 'pdf') {
        new Notice('Please open a PDF file first');
        return;
    }

    const pdfData = await app.vault.readBinary(activeFile);

    try {
        // Convert ArrayBuffer to Base64
        const pdfBase64 = arrayBufferToBase64(pdfData);

        const requestBody = JSON.stringify({
            file: `data:application/pdf;base64,${pdfBase64}`,
            filename: activeFile.name
        });

        console.log('Request body length:', requestBody.length);
        console.log('Filename:', activeFile.name);

        // Send the PDF to the Flask server
        const response = await requestUrl({
            url: 'http://office.lan.cchh.space:5000/convert',
            method: 'POST',
            body: requestBody,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            throw: false,
        });

        console.log('Response status:', response.status);

        if (response.status !== 200) {
            throw new Error(`Server responded with status ${response.status}: ${response.text}`);
        }

        const result = response.json;

        if (!result.success || !result.files) {
            throw new Error('Server did not return expected data');
        }

        const folderName = "";
        const basePath = activeFile.path.replace('PDFs', 'Markdown').replace('.pdf', '').replace('.PDF', '')
        const folderPath = basePath + folderName;
        const imagesPath = folderPath;

        await createFolderIfNotExists(app, basePath);
        await createFolderIfNotExists(app, folderPath);
        await createFolderIfNotExists(app, imagesPath);

        // Save files
        for (const file of result.files) {
            if (file.type === 'markdown') {
                const mdPath = `${folderPath}/markdown.md`;
                await createOrUpdateFile(app, mdPath, file.content);
            } else if (file.type === 'image') {
                const imgPath = `${imagesPath}/${file.name}`;
                const binaryContent = base64ToArrayBuffer(file.content);
                await createOrUpdateBinaryFile(app, imgPath, binaryContent);
            }
        }

        new Notice('PDF extraction complete');
    } catch (error) {
        console.error('Error during PDF extraction:', error);
        new Notice(`Failed to extract PDF: ${error.message}. Check the console for details.`);
    }
}

async function createFolderIfNotExists(app: App, path: string): Promise<void> {
    const folder = app.vault.getAbstractFileByPath(path);
    if (!folder) {
        try {
            await app.vault.createFolder(path);
        } catch (error) {
            if (error.message.includes('Folder already exists')) {
                console.log(`Folder already exists: ${path}`);
            } else {
                throw error;
            }
        }
    }
}

async function ensureDirectoryExists(app: App, path: string): Promise<void> {
    const dirs = path.split('/').slice(0, -1).join('/');
    if (dirs) {
        await createFolderIfNotExists(app, dirs);
    }
}

async function createOrUpdateFile(app: App, path: string, content: string): Promise<void> {
    try {
        await ensureDirectoryExists(app, path);

        let file = app.vault.getAbstractFileByPath(path);
        await app.vault.delete(file);
        await app.vault.create(path, content);
    } catch (error) {
        console.error(`Error creating/modifying file at ${path}:`, error);
        throw error;
    }
}

async function createOrUpdateBinaryFile(app: App, path: string, content: ArrayBuffer): Promise<void> {
    try {
        await ensureDirectoryExists(app, path);
        let file = app.vault.getAbstractFileByPath(path);
        await app.vault.createBinary(path, content);
    } catch (error) {
        console.error(`Error creating/modifying binary file at ${path}:`, error);
        throw error;
    }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export async function extractAllPDFsToMarkdown(app: App) {
  const activeFile = app.workspace.getActiveFile();
      if (!activeFile) {
          new Notice('No active file');
          return;
      }

      const folder = activeFile.parent;
      if (!folder) {
          new Notice('Unable to determine the current folder');
          return;
      }

      const pdfFiles = folder.children.filter((file) => file instanceof TFile && file.extension === 'pdf');

      if (pdfFiles.length === 0) {
          new Notice('No PDF files found in the current folder');
          return;
      }

      new Notice(`Found ${pdfFiles.length} PDF files. Starting conversion...`);

      for (const pdfFile of pdfFiles) {
          try {
              await processSinglePDF(app, pdfFile as TFile);
              new Notice(`Converted ${pdfFile.name}`);
          } catch (error) {
              console.error(`Error converting ${pdfFile.name}:`, error);
              new Notice(`Failed to convert ${pdfFile.name}`);
          }
      }

      new Notice('All PDF conversions complete');
  }

  async function processSinglePDF(app: App, file: TFile) {
      if (file.extension !== 'pdf') {
          throw new Error('The selected file is not a PDF');
      }

      const pdfData = await app.vault.readBinary(file);

      // Convert ArrayBuffer to Base64
      const pdfBase64 = arrayBufferToBase64(pdfData);

      const requestBody = JSON.stringify({
          file: `data:application/pdf;base64,${pdfBase64}`,
          filename: file.name
      });

      console.log('Request body length:', requestBody.length);
      console.log('Filename:', file.name);

      // Send the PDF to the Flask server
      const response = await requestUrl({
          url: 'http://localhost:5000/convert',
          method: 'POST',
          body: requestBody,
          headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
          },
          throw: false,
      });

      console.log('Response status:', response.status);

      if (response.status !== 200) {
          throw new Error(`Server responded with status ${response.status}: ${response.text}`);
      }

      const result = response.json;

      if (!result.success || !result.files) {
          throw new Error('Server did not return expected data');
      }

      const folderName = "";
      const basePath = file.path.replace('PDFs', 'Markdown').replace('.pdf', '').replace('.PDF', '')
      const folderPath = basePath + folderName;
      const imagesPath = folderPath;

      await createFolderIfNotExists(app, basePath);
      await createFolderIfNotExists(app, folderPath);
      await createFolderIfNotExists(app, imagesPath);

      // Save files
      for (const resultFile of result.files) {
          if (resultFile.type === 'markdown') {
              const mdPath = `${folderPath}/markdown.md`;
              await createOrUpdateFile(app, mdPath, resultFile.content);
          } else if (resultFile.type === 'image') {
              const imgPath = `${imagesPath}/${resultFile.name}`;
              const binaryContent = base64ToArrayBuffer(resultFile.content);
              await createOrUpdateBinaryFile(app, imgPath, binaryContent);
          }
      }
  }
