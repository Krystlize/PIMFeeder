# PIM Feeder

A React application for processing and managing product information.

## Deployment

- Frontend: Deployed to GitHub Pages at https://krystlize.github.io/PIMFeeder
- Backend API: Deployed to Vercel at https://pimfeederplus-git-main-krystlizes-projects.vercel.app

## Features

- PDF processing with AI
- Product attribute extraction
- Interactive chat interface for modifying attributes

## Development

To run locally:

```bash
npm install
npm start
```

## Environment Variables

- REACT_APP_API_URL: API base URL
- REACT_APP_API_BASE_URL: API endpoint base URL
- REACT_APP_HUGGING_FACE_TOKEN: For AI features

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
