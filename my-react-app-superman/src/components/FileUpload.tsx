import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography, Paper, Button, CircularProgress } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

interface FileUploadProps {
  onFileSelected: (file: File) => void;
  isProcessing: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelected, isProcessing }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      onFileSelected(file);
    }
  }, [onFileSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled: isProcessing
  });

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 3, 
        mb: 3, 
        border: '2px dashed',
        borderColor: isDragActive ? 'primary.main' : 'grey.400',
        bgcolor: isDragActive ? 'rgba(25, 118, 210, 0.04)' : 'background.paper',
        transition: 'all 0.3s ease'
      }}
    >
      <Box
        {...getRootProps()}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          cursor: isProcessing ? 'default' : 'pointer',
          py: 3
        }}
      >
        <input {...getInputProps()} />
        
        {isProcessing ? (
          <>
            <CircularProgress size={50} sx={{ mb: 2 }} />
            <Typography variant="h6" align="center" gutterBottom>
              Processing PDF...
            </Typography>
          </>
        ) : selectedFile ? (
          <>
            <PictureAsPdfIcon fontSize="large" color="primary" sx={{ fontSize: 60, mb: 2 }} />
            <Typography variant="h6" align="center" gutterBottom>
              {selectedFile.name}
            </Typography>
            <Typography variant="body2" color="textSecondary" align="center">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </Typography>
            <Button 
              variant="outlined" 
              color="primary" 
              sx={{ mt: 2 }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
              }}
            >
              Change File
            </Button>
          </>
        ) : (
          <>
            <CloudUploadIcon fontSize="large" color="primary" sx={{ fontSize: 60, mb: 2 }} />
            <Typography variant="h6" align="center" gutterBottom>
              {isDragActive ? 'Drop PDF here' : 'Drag & drop PDF here'}
            </Typography>
            <Typography variant="body2" color="textSecondary" align="center">
              or click to browse files
            </Typography>
            <Typography variant="caption" color="textSecondary" align="center" sx={{ mt: 1 }}>
              Only PDF files are accepted
            </Typography>
          </>
        )}
      </Box>
    </Paper>
  );
};

export default FileUpload; 