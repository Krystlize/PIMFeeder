import React, { useState } from 'react';
import { processPDFWithAI } from '../services/backendService';
import { ProcessingResult } from '../types';

interface PDFUploadProps {
  onProcessingComplete: (result: ProcessingResult) => void;
}

const PDFUpload: React.FC<PDFUploadProps> = ({ onProcessingComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [division, setDivision] = useState('');
  const [category, setCategory] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !division || !category) {
      setError('Please fill in all fields');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await processPDFWithAI(file, division, category);
      onProcessingComplete(result);
    } catch (err) {
      setError('Error processing PDF. Please try again.');
      console.error('Error processing PDF:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="pdf-upload">
      <h2>Upload PDF</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="file">PDF File:</label>
          <input
            type="file"
            id="file"
            accept=".pdf"
            onChange={handleFileChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="division">Division:</label>
          <input
            type="text"
            id="division"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="category">Category:</label>
          <input
            type="text"
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          />
        </div>
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={isProcessing}>
          {isProcessing ? 'Processing...' : 'Upload and Process'}
        </button>
      </form>
    </div>
  );
};

export default PDFUpload; 