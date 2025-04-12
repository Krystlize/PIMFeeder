import React, { useState } from 'react';
import { 
  Button, 
  Box, 
  CircularProgress, 
  Typography, 
  Alert,
  Snackbar
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
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

  const handleSync = async () => {
    setIsSyncing(true);
    
    try {
      const success = await syncToPim(results);
      setSyncSuccess(success);
      setShowNotification(true);
    } catch (error) {
      console.error('Error syncing to PIM:', error);
      setSyncSuccess(false);
      setShowNotification(true);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCloseNotification = () => {
    setShowNotification(false);
  };

  return (
    <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
      
      {disabled && results.attributes.length === 0 && (
        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ mt: 1 }}
        >
          Process a PDF to enable syncing
        </Typography>
      )}

      <Snackbar
        open={showNotification}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={syncSuccess ? "success" : "error"} 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {syncSuccess 
            ? 'Successfully synced attributes to PIM!' 
            : 'Failed to sync attributes to PIM. Please try again.'}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SyncToPim; 