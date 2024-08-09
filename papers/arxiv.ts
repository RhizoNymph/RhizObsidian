import { App, Modal, Notice, request, TFile } from 'obsidian';
import RhizObsidian from '../main';

export class ArxivSearchModal extends Modal {
    plugin: RhizObsidian;
    

    constructor(app: App, plugin: RhizObsidian) {
        super(app);
        this.plugin = plugin;
        this.plugin.categories = this.loadCategories();
    }

    onOpen() {
        const { contentEl } = this;
        
        contentEl.empty();
        contentEl.createEl('h1', { text: 'Search Arxiv Papers' });

        const searchInput = contentEl.createEl('input', { type: 'text' });
        const searchButton = contentEl.createEl('button', { text: 'Search' });

        const handleSearch = async () => {
            const query = encodeURIComponent(searchInput.value);
            await this.performSearch(query, 0);
        };

        searchButton.onclick = handleSearch;

        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                handleSearch();
            }
        });
    }

    async performSearch(query: string, start: number) {
        const url = `https://export.arxiv.org/api/query?search_query=${query}&start=${start}&max_results=5&sortBy=relevance&sortOrder=ascending`;
        try {
            const response = await request({ url });
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(response, "text/xml");
            const entries = Array.from(xmlDoc.querySelectorAll("entry")).map(entry => {
                return {
                    title: entry.querySelector("title")?.textContent,
                    summary: entry.querySelector("summary")?.textContent,   
                    id: entry.querySelector("id")?.textContent,
                    authors: Array.from(entry.querySelectorAll("author")).map(author => author.querySelector("name")?.textContent),
                    published: entry.querySelector("published")?.textContent,                    
                    categories: Array.from(entry.querySelectorAll("category")).map(category => category.getAttribute("term"))
                }
            });
            
            let totalResults = 0;
            const totalResultsElement = xmlDoc.querySelector("opensearch\\:totalResults, totalResults");
            if (totalResultsElement) {
                totalResults = parseInt(totalResultsElement.textContent || "0");
            } else {
                const allEntries = xmlDoc.querySelectorAll("entry");
                totalResults = allEntries.length;
            }                                                
            new SearchResultsModal(this.app, this.plugin, entries, query, start, totalResults).open();
        } catch (error) {
            console.error('Failed to fetch papers:', error);
            new Notice('Failed to fetch papers.');
        }
    }

    loadCategories() {
        const categoriesJson = [
              {
                "id": "cs.AI",
                "name": "Artificial Intelligence"
              },
              {
                "id": "cs.AR",
                "name": "Hardware Architecture"
              },
              {
                "id": "cs.CC",
                "name": "Computational Complexity"
              },
              {
                "id": "cs.CE",
                "name": "Computational Engineering, Finance, and Science"
              },
              {
                "id": "cs.CG",
                "name": "Computational Geometry"
              },
              {
                "id": "cs.CL",
                "name": "Computation and Language"
              },
              {
                "id": "cs.CR",
                "name": "Cryptography and Security"
              },
              {
                "id": "cs.CV",
                "name": "Computer Vision and Pattern Recognition"
              },
              {
                "id": "cs.CY",
                "name": "Computers and Society"
              },
              {
                "id": "cs.DB",
                "name": "Databases"
              },
              {
                "id": "cs.DC",
                "name": "Distributed, Parallel, and Cluster Computing"
              },
              {
                "id": "cs.DL",
                "name": "Digital Libraries"
              },
              {
                "id": "cs.DM",
                "name": "Discrete Mathematics"
              },
              {
                "id": "cs.DS",
                "name": "Data Structures and Algorithms"
              },
              {
                "id": "cs.ET",
                "name": "Emerging Technologies"
              },
              {
                "id": "cs.FL",
                "name": "Formal Languages and Automata Theory"
              },
              {
                "id": "cs.GL",
                "name": "General Literature"
              },
              {
                "id": "cs.GR",
                "name": "Graphics"
              },
              {
                "id": "cs.GT",
                "name": "Computer Science and Game Theory"
              },
              {
                "id": "cs.HC",
                "name": "Human-Computer Interaction"
              },
              {
                "id": "cs.IR",
                "name": "Information Retrieval"
              },
              {
                "id": "cs.IT",
                "name": "Information Theory"
              },
              {
                "id": "cs.LG",
                "name": "Machine Learning"
              },
              {
                "id": "cs.LO",
                "name": "Logic in Computer Science"
              },
              {
                "id": "cs.MA",
                "name": "Multiagent Systems"
              },
              {
                "id": "cs.MM",
                "name": "Multimedia"
              },
              {
                "id": "cs.MS",
                "name": "Mathematical Software"
              },
              {
                "id": "cs.NA",
                "name": "Numerical Analysis"
              },
              {
                "id": "cs.NE",
                "name": "Neural and Evolutionary Computing"
              },
              {
                "id": "cs.NI",
                "name": "Networking and Internet Architecture"
              },
              {
                "id": "cs.OH",
                "name": "Other Computer Science"
              },
              {
                "id": "cs.OS",
                "name": "Operating Systems"
              },
              {
                "id": "cs.PF",
                "name": "Performance"
              },
              {
                "id": "cs.PL",
                "name": "Programming Languages"
              },
              {
                "id": "cs.RO",
                "name": "Robotics"
              },
              {
                "id": "cs.SC",
                "name": "Symbolic Computation"
              },
              {
                "id": "cs.SD",
                "name": "Sound"
              },
              {
                "id": "cs.SE",
                "name": "Software Engineering"
              },
              {
                "id": "cs.SI",
                "name": "Social and Information Networks"
              },
              {
                "id": "cs.SY",
                "name": "Systems and Control"
              }
            ,
              {
                "id": "econ.EM",
                "name": "Econometrics"
              },
              {
                "id": "econ.GN",
                "name": "General Economics"
              },
              {
                "id": "econ.TH",
                "name": "Theoretical Economics"
              }
            ,
              {
                "id": "eess.AS",
                "name": "Audio and Speech Processing"
              },
              {
                "id": "eess.IV",
                "name": "Image and Video Processing"
              },
              {
                "id": "eess.SP",
                "name": "Signal Processing"
              },
              {
                "id": "eess.SY",
                "name": "Systems and Control"
              }
            ,
              {
                "id": "math.AC",
                "name": "Commutative Algebra"
              },
              {
                "id": "math.AG",
                "name": "Algebraic Geometry"
              },
              {
                "id": "math.AP",
                "name": "Analysis of PDEs"
              },
              {
                "id": "math.AT",
                "name": "Algebraic Topology"
              },
              {
                "id": "math.CA",
                "name": "Classical Analysis and ODEs"
              },
              {
                "id": "math.CO",
                "name": "Combinatorics"
              },
              {
                "id": "math.CT",
                "name": "Category Theory"
              },
              {
                "id": "math.CV",
                "name": "Complex Variables"
              }
            ,
              {
                "id": "physics.acc-ph",
                "name": "Accelerator Physics"
              },
              {
                "id": "physics.ao-ph",
                "name": "Atmospheric and Oceanic Physics"
              },
              {
                "id": "physics.app-ph",
                "name": "Applied Physics"
              },
              {
                "id": "physics.atm-clus",
                "name": "Atomic and Molecular Clusters"
              },
              {
                "id": "physics.atom-ph",
                "name": "Atomic Physics"
              },
              {
                "id": "physics.bio-ph",
                "name": "Biological Physics"
              },
              {
                "id": "physics.chem-ph",
                "name": "Chemical Physics"
              },
              {
                "id": "physics.class-ph",
                "name": "Classical Physics"
              },
              {
                "id": "physics.comp-ph",
                "name": "Computational Physics"
              },
              {
                "id": "physics.data-an",
                "name": "Data Analysis, Statistics and Probability"
              },
              {
                "id": "physics.ed-ph",
                "name": "Physics Education"
              },
              {
                "id": "physics.flu-dyn",
                "name": "Fluid Dynamics"
              },
              {
                "id": "physics.gen-ph",
                "name": "General Physics"
              },
              {
                "id": "physics.geo-ph",
                "name": "Geophysics"
              },
              {
                "id": "physics.hist-ph",
                "name": "History and Philosophy of Physics"
              },
              {
                "id": "physics.ins-det",
                "name": "Instrumentation and Detectors"
              },
              {
                "id": "physics.med-ph",
                "name": "Medical Physics"
              },
              {
                "id": "physics.optics",
                "name": "Optics"
              },
              {
                "id": "physics.plasm-ph",
                "name": "Plasma Physics"
              },
              {
                "id": "physics.pop-ph",
                "name": "Popular Physics"
              },
              {
                "id": "physics.soc-ph",
                "name": "Physics and Society"
              },
              {
                "id": "physics.space-ph",
                "name": "Space Physics"
              }
            ,
              {
                "id": "q-bio.BM",
                "name": "Biomolecules"
              },
              {
                "id": "q-bio.CB",
                "name": "Cell Behavior"
              },
              {
                "id": "q-bio.GN",
                "name": "Genomics"
              },
              {
                "id": "q-bio.MN",
                "name": "Molecular Networks"
              },
              {
                "id": "q-bio.NC",
                "name": "Neurons and Cognition"
              },
              {
                "id": "q-bio.OT",
                "name": "Other Quantitative Biology"
              },
              {
                "id": "q-bio.PE",
                "name": "Populations and Evolution"
              },
              {
                "id": "q-bio.QM",
                "name": "Quantitative Methods"
              },
              {
                "id": "q-bio.SC",
                "name": "Subcellular Processes"
              },
              {
                "id": "q-bio.TO",
                "name": "Tissues and Organs"
              }
            ,
              {
                "id": "q-fin.CP",
                "name": "Computational Finance"
              },
              {
                "id": "q-fin.EC",
                "name": "Economics"
              },
              {
                "id": "q-fin.GN",
                "name": "General Finance"
              },
              {
                "id": "q-fin.MF",
                "name": "Mathematical Finance"
              },
              {
                "id": "q-fin.PM",
                "name": "Portfolio Management"
              },
              {
                "id": "q-fin.PR",
                "name": "Pricing of Securities"
              },
              {
                "id": "q-fin.RM",
                "name": "Risk Management"
              },
              {
                "id": "q-fin.ST",
                "name": "Statistical Finance"
              },
              {
                "id": "q-fin.TR",
                "name": "Trading and Market Microstructure"
              }
            ,
              {
                "id": "stat.AP",
                "name": "Applications"
              },
              {
                "id": "stat.CO",
                "name": "Computation"
              },
              {
                "id": "stat.ME",
                "name": "Methodology"
              },
              {
                "id": "stat.ML",
                "name": "Machine Learning"
              },
              {
                "id": "stat.OT",
                "name": "Other Statistics"
              },
              {
                "id": "stat.TH",
                "name": "Statistics Theory"
              }
        ];
    
        return categoriesJson;
    };
}

class SearchResultsModal extends Modal {
    plugin: RhizObsidian;
    results: any[];
    query: string;
    start: number;
    totalResults: number;

    constructor(app: App, plugin: RhizObsidian, results: any[], query: string, start: number, totalResults: number) {
        super(app);
        this.plugin = plugin;
        this.results = results;
        this.query = query;
        this.start = start;
        this.totalResults = totalResults;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h1', { text: 'Search Results' });

        this.results.forEach(result => {
            const resultEl = contentEl.createEl('div', { cls: 'search-result' });
            const titleEl = resultEl.createEl('h2', { text: result.title });
            const authorsEl = resultEl.createEl('p', { text: result.authors.join(', ') });
            const publishedEl = resultEl.createEl('p', { text: result.published });
            // Map category codes to names
            const categoryNames = result.categories.map((code: string) => {
                const category = this.plugin.categories.find(cat => cat.id === code);
                return category ? category.name : code; 
            });

            const categoriesEl = resultEl.createEl('p', { text: categoryNames.join(', ') });

            const summaryContainer = resultEl.createEl('div', { cls: 'summary-container' });
            const summaryToggle = summaryContainer.createEl('button', { text: 'Show Summary', cls: 'summary-toggle' });
            const summaryContent = summaryContainer.createEl('p', { text: result.summary, cls: 'summary-content hidden' });

            summaryToggle.onclick = () => {
                summaryContent.classList.toggle('hidden');
                summaryToggle.textContent = summaryContent.classList.contains('hidden') ? 'Show Summary' : 'Hide Summary';
            };

            const createNoteButton = resultEl.createEl('button', { text: 'Create Note' });
            createNoteButton.onclick = async () => {
                await this.createNoteAndDownloadPDF(result);
            };
        });

        this.addPagination(contentEl);
        this.addStyle();
    }

    addPagination(contentEl: HTMLElement) {
        const pagination = contentEl.createEl('div', { cls: 'pagination' });
        const prevButton = pagination.createEl('button', { text: 'Previous' });
        const nextButton = pagination.createEl('button', { text: 'Next' });
        
        let pageInfoText;
        if (this.totalResults > 0) {
            pageInfoText = `Showing ${this.start + 1}-${Math.min(this.start + this.results.length, this.totalResults)} of ${this.totalResults}`;
        } else {
            pageInfoText = `Showing ${this.start + 1}-${this.start + this.results.length}`;
        }
        const pageInfo = pagination.createEl('span', { text: pageInfoText });

        prevButton.onclick = async () => {
            if (this.start > 0) {
                this.close();
                await new ArxivSearchModal(this.app, this.plugin).performSearch(this.query, Math.max(0, this.start - 5));
            }
        };

        nextButton.onclick = async () => {
            if (this.results.length === 5) {  // If we have a full page, there might be more
                this.close();
                await new ArxivSearchModal(this.app, this.plugin).performSearch(this.query, this.start + 5);
            }
        };

        prevButton.disabled = this.start === 0;
        nextButton.disabled = this.results.length < 5;  // Disable next if we don't have a full page
    }

    addStyle() {
        const style = document.createElement('style');
        style.textContent = `
            .search-result {
                margin-bottom: 20px;
            }
            .summary-container {
                margin-top: 10px;
            }
            .summary-toggle {
                margin-bottom: 5px;
            }
            .summary-content {
                margin-left: 20px;
            }
            .hidden {
                display: none;
            }
            .pagination {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 20px;
            }
            .pagination button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        `;
        document.head.appendChild(style);
    }

    async createNoteAndDownloadPDF(result: any) {        
        const sanitizedTitle = result.title.replace(/[\\/:*?"<>|]/g, '-');
        const dirPath = `Sources/Papers/`;
        const filePath = `${dirPath}/Abstracts/${sanitizedTitle}.md`;

        // Ensure the directory exists before creating the file
        await this.app.vault.createFolder(dirPath).catch(err => console.error('Error creating folder:', err));

        // Create the note with the summary
        await this.app.vault.create(filePath, result.summary).catch(err => {
            console.error('Error creating note:', err);
            new Notice('Error creating note.');
        });

        const pdfUrl = result.id.replace('abs', 'pdf');
        
        try {
            const response = await fetch(pdfUrl);
            if (!response.ok) throw new Error('Failed to fetch PDF');
            const pdfBlob = await response.blob();
            const arrayBuffer = await pdfBlob.arrayBuffer();
            await this.app.vault.createBinary(`${dirPath}/PDFs/${sanitizedTitle}.pdf`, arrayBuffer);
            
            new Notice('PDF downloaded successfully');
        } catch (error) {
            console.error('Failed to download PDF:', error);
            new Notice('Failed to download PDF.');
        }
    }

    
}

