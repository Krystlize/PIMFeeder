import React from 'react';
import { 
  Button, 
  Box, 
  CircularProgress, 
  Typography 
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

interface ProcessButtonProps {
  onClick: () => void;
  disabled: boolean;
  isProcessing: boolean;
  validationError?: string;
}

const ProcessButton: React.FC<ProcessButtonProps> = ({ 
  onClick, 
  disabled, 
  isProcessing,
  validationError
}) => {
  return (
    <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Button
        variant="contained"
        color="primary"
        size="large"
        startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
        onClick={onClick}
        disabled={disabled || isProcessing}
        sx={{ py: 1.5, px: 4 }}
      >
        {isProcessing ? 'Processing...' : 'Process PDF'}
      </Button>
      
      {validationError && (
        <Typography 
          variant="caption" 
          color="error" 
          sx={{ mt: 1 }}
        >
          {validationError}
        </Typography>
      )}
    </Box>
  );
};

export default ProcessButton; 