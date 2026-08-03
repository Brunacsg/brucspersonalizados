const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const data = new Uint8Array(fs.readFileSync('webservice_spot.pdf'));

(async () => {
    const loadingTask = pdfjsLib.getDocument({ data });
    const doc = await loadingTask.promise;
    console.log('pages:', doc.numPages);

    let fullText = '';
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(item => item.str);
        fullText += strings.join(' ') + '\n\n';
        if (i === 5) break; // preview first 5 pages
    }

    console.log('\n--- PDF TEXT PREVIEW (first 5 pages) ---\n');
    console.log(fullText.slice(0, 8000));
})().catch(err => console.error('pdfjs error', err));
