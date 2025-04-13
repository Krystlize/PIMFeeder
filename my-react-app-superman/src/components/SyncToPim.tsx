import React, { useState } from 'react';
import { 
  Button, 
  Box, 
  CircularProgress, 
  Typography, 
  Alert,
  Snackbar,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import DownloadIcon from '@mui/icons-material/Download';
import { ProcessingResult } from '../types';
import { syncToPim } from '../services/pdfProcessingService';

interface SyncToPimProps {
  results: ProcessingResult;
  disabled: boolean;
}

const SyncToPim: React.FC<SyncToPimProps> = ({ results, disabled }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<boolean | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string>('');
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [jsonData, setJsonData] = useState<string>('');

  // Generate formatted JSON data
  const generateJsonData = () => {
    // Create a cleaned up JSON object with all attributes
    const data = {
      metadata: {
        extractedAt: new Date().toISOString(),
        totalAttributes: results.attributes.length,
        source: "PIMFeeder"
      },
      attributes: results.attributes.map(attr => ({
        name: attr.name,
        description: attr.value,
        ...(attr.suffix ? { suffix_code: attr.suffix } : {})
      }))
    };
    
    // Convert to a JSON string with nice formatting
    return JSON.stringify(data, null, 2);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    
    try {
      // For mock data, show a preview of what would be sent
      const formattedJson = generateJsonData();
      setJsonData(formattedJson);
      setShowJsonPreview(true);
      
      // Simulate API call for mock purposes
      const success = await syncToPim(results);
      setSyncSuccess(success);
      
      // Only show notification if the dialog is closed
      if (!showJsonPreview) {
        setNotificationMessage('Successfully synced attributes to PIM!');
        setNotificationType('success');
        setShowNotification(true);
      }
    } catch (error) {
      console.error('Error syncing to PIM:', error);
      setSyncSuccess(false);
      setNotificationMessage('Failed to sync attributes to PIM. Please try again.');
      setNotificationType('error');
      setShowNotification(true);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadJson = () => {
    try {
      // Generate the JSON data
      const jsonString = generateJsonData();
      
      // Create a blob with the JSON data
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Create a URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.download = `pim-attributes-${new Date().toISOString().slice(0, 10)}.json`;
      
      // Append to the document, click it, and remove it
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      URL.revokeObjectURL(url);
      
      // Show success notification
      setNotificationMessage('Attributes JSON file downloaded successfully!');
      setNotificationType('success');
      setShowNotification(true);
    } catch (error) {
      console.error('Error downloading JSON:', error);
      setNotificationMessage('Failed to download attributes JSON. Please try again.');
      setNotificationType('error');
      setShowNotification(true);
    }
  };

  const handleCloseNotification = () => {
    setShowNotification(false);
  };

  const handleCloseJsonPreview = () => {
    setShowJsonPreview(false);
    if (syncSuccess) {
      setNotificationMessage('Successfully synced attributes to PIM!');
      setNotificationType('success');
      setShowNotification(true);
    }
  };

  return (
    <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={isSyncing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />}
          onClick={handleSync}
          disabled={disabled || isSyncing || results.attributes.length === 0}
          sx={{ py: 1.5, px: 4 }}
        >
          {isSyncing ? 'Syncing to PIM...' : 'Sync to PIM'}
        </Button>
        
        <Button
          variant="outlined"
          color="primary"
          size="large"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadJson}
          disabled={disabled || results.attributes.length === 0}
          sx={{ py: 1.5, px: 4 }}
        >
          Download JSON
        </Button>
      </Stack>
      
      {disabled && results.attributes.length === 0 && (
        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ mt: 1 }}
        >
          Process a PDF to enable syncing
        </Typography>
      )}

      {/* JSON Preview Dialog */}
      <Dialog
        open={showJsonPreview}
        onClose={handleCloseJsonPreview}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Data to be sent to PIM</DialogTitle>
        <DialogContent>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              maxHeight: '60vh', 
              overflow: 'auto',
              backgroundColor: '#f5f5f5',
              fontFamily: 'monospace'
            }}
          >
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
              {jsonData}
            </pre>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseJsonPreview} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={showNotification}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notificationType} 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {notificationMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SyncToPim; 