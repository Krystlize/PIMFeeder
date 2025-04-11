import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ProcessingResult, ProcessedAttribute } from '../types';
import { updateAttributesWithLLM } from '../services/backendService';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  result: ProcessingResult;
  pdfUrl: string;
  onAttributesUpdate: (updatedResult: ProcessingResult) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ result, pdfUrl, onAttributesUpdate }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleAttributeUpdate = async (attributeName: string, newValue: string) => {
    setIsUpdating(true);
    setError(null);

    try {
      const updatedAttributes = await updateAttributesWithLLM(
        `Update ${attributeName} to ${newValue}`,
        result.attributes,
        result.rawText || ''
      );
      
      onAttributesUpdate({
        ...result,
        attributes: updatedAttributes
      });
    } catch (err) {
      setError('Error updating attributes. Please try again.');
      console.error('Error updating attributes:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="pdf-viewer">
      <h2>PDF Viewer</h2>
      <div className="pdf-container">
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
        >
          <Page pageNumber={pageNumber} />
        </Document>
      </div>
      <div className="pagination">
        <button
          onClick={() => setPageNumber(pageNumber - 1)}
          disabled={pageNumber <= 1}
        >
          Previous
        </button>
        <span>
          Page {pageNumber} of {numPages || '--'}
        </span>
        <button
          onClick={() => setPageNumber(pageNumber + 1)}
          disabled={pageNumber >= (numPages || 0)}
        >
          Next
        </button>
      </div>
      <div className="attributes">
        <h3>Extracted Attributes</h3>
        {result.attributes.map((attr) => (
          <div key={attr.name} className="attribute">
            <label>{attr.name}:</label>
            <input
              type="text"
              value={attr.value}
              onChange={(e) => handleAttributeUpdate(attr.name, e.target.value)}
              disabled={isUpdating}
            />
          </div>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default PDFViewer; 