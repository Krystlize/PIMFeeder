# PIMFeeder

A React application for extracting product attributes from PDF documents and syncing them to PIM (Product Information Management) systems.

## Features

- Upload PDF files through a drag-and-drop interface
- Select product division and category (plumbing, HVAC, electrical, etc.)
- Extract product attributes using OCR and LLM technology
- Review and modify extracted attributes via chat interface
- Sync product data to PIM systems

## Technologies Used

- React with TypeScript
- Material-UI for the user interface
- React Dropzone for file uploading
- PDF-lib for PDF processing
- Tesseract.js for OCR capabilities

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/pimfeeder.git
   cd pimfeeder
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage

1. Drag and drop a PDF file into the upload area, or click to browse files
2. Select the appropriate division and category for the product
3. Click the "Process PDF" button to extract attributes
4. Review the extracted attributes in the right panel
5. Use the chat interface to modify any incorrect attributes
6. Click "Sync to PIM" to send the data to your PIM system

## Deployment

To build the application for production:

```bash
npm run build
```

This will create an optimized build in the `build` folder that you can deploy to any static web hosting service.

## Future Enhancements

- Integration with specific PIM systems (SAP, Akeneo, Pimcore, etc.)
- Enhanced attribute extraction accuracy
- Bulk document processing
- User authentication and role-based access control
- Historical data and processing logs

## License

This project is licensed under the MIT License - see the LICENSE file for details.
