import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  TextField, 
  IconButton, 
  Typography, 
  List, 
  ListItem, 
  CircularProgress,
  Divider,
  Avatar,
  Alert,
  Collapse,
  Chip
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { ChatMessage, ProcessedAttribute } from '../types';
import { sendMessageToLLM, createNewMessage, updateAttributeBasedOnChat } from '../services/chatService';

interface ChatInterfaceProps {
  attributes: ProcessedAttribute[];
  onAttributesUpdate: (newAttributes: ProcessedAttribute[]) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ attributes, onAttributesUpdate }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    createNewMessage(
      "I've extracted these attributes from your PDF. You can ask me to modify them or explain them in more detail.",
      'system'
    )
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [attributeChanges, setAttributeChanges] = useState<{added: ProcessedAttribute[], modified: ProcessedAttribute[]}>({
    added: [],
    modified: []
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Function to find differences between original and updated attributes
  const findAttributeChanges = (original: ProcessedAttribute[], updated: ProcessedAttribute[]) => {
    const added: ProcessedAttribute[] = [];
    const modified: ProcessedAttribute[] = [];
    
    // Find new and modified attributes
    updated.forEach(newAttr => {
      const originalAttr = original.find(attr => attr.name === newAttr.name);
      if (!originalAttr) {
        added.push({...newAttr, updated: true});
      } else if (originalAttr.value !== newAttr.value) {
        modified.push({
          ...newAttr, 
          updated: true,
          oldValue: originalAttr.value 
        });
      }
    });
    
    return { added, modified };
  };

  const handleSendMessage = async () => {
    if (newMessage.trim() === '') return;

    // Add user message to the list
    const userMessage = createNewMessage(newMessage, 'user');
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setNewMessage('');
    setIsLoading(true);

    try {
      // Update attributes based on user message
      const updatedAttributes = await updateAttributeBasedOnChat(newMessage, attributes, JSON.stringify(attributes));
      
      // If attributes changed, update them and show notification
      if (JSON.stringify(updatedAttributes) !== JSON.stringify(attributes)) {
        // Mark updated attributes
        const enhancedAttributes = updatedAttributes.map(newAttr => {
          const originalAttr = attributes.find(attr => attr.name === newAttr.name);
          if (!originalAttr) {
            // This is a new attribute
            return {...newAttr, updated: true};
          } else if (originalAttr.value !== newAttr.value) {
            // This is a modified attribute
            return {
              ...newAttr, 
              updated: true,
              oldValue: originalAttr.value 
            };
          }
          // Unchanged attribute
          return newAttr;
        });
        
        const changes = findAttributeChanges(attributes, enhancedAttributes);
        setAttributeChanges(changes);
        
        if (changes.added.length > 0 || changes.modified.length > 0) {
          setShowNotification(true);
          
          // Auto-hide notification after 8 seconds
          setTimeout(() => {
            setShowNotification(false);
          }, 8000);
        }
        
        onAttributesUpdate(enhancedAttributes);
      }

      // Get response from LLM
      const response = await sendMessageToLLM(newMessage, updatedAttributes, JSON.stringify(updatedAttributes));
      
      // Add system response to the list
      const systemMessage = createNewMessage(response, 'system');
      setMessages(prevMessages => [...prevMessages, systemMessage]);
    } catch (error) {
      // Add error message
      const errorMessage = createNewMessage(
        'Sorry, there was an error processing your request.',
        'system'
      );
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, display: 'flex', flexDirection: 'column', height: 400 }}>
      <Typography variant="h6" gutterBottom>
        Ask for Modifications
      </Typography>
      
      <Collapse in={showNotification}>
        <Alert 
          icon={<CheckCircleIcon fontSize="inherit" />}
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setShowNotification(false)}
        >
          <Typography variant="subtitle2">Attributes have been updated!</Typography>
          
          {attributeChanges.added.length > 0 && (
            <Box mt={1}>
              <Typography variant="body2" fontWeight="bold">Added:</Typography>
              {attributeChanges.added.map((attr, i) => (
                <Box key={`added-${i}`} display="flex" alignItems="center" mt={0.5}>
                  <Chip size="small" label={attr.name} color="success" sx={{ mr: 1 }} />
                  <Typography variant="body2">{attr.value}</Typography>
                </Box>
              ))}
            </Box>
          )}
          
          {attributeChanges.modified.length > 0 && (
            <Box mt={1}>
              <Typography variant="body2" fontWeight="bold">Modified:</Typography>
              {attributeChanges.modified.map((attr, i) => (
                <Box key={`modified-${i}`} mt={0.5}>
                  <Box display="flex" alignItems="center">
                    <Chip size="small" label={attr.name} color="warning" sx={{ mr: 1 }} />
                  </Box>
                  <Box mt={0.5}>
                    <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                      {attr.oldValue}
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      {attr.value}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Alert>
      </Collapse>
      
      <Box sx={{ flexGrow: 1, overflow: 'auto', mb: 2 }}>
        <List>
          {messages.map((msg) => (
            <ListItem key={msg.id} sx={{ 
              flexDirection: 'column', 
              alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              px: 1,
              py: 0.5
            }}>
              <Box 
                sx={{ 
                  display: 'flex', 
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  maxWidth: '80%'
                }}
              >
                <Avatar 
                  sx={{ 
                    bgcolor: msg.sender === 'user' ? 'primary.main' : 'secondary.main',
                    width: 32,
                    height: 32,
                    mr: 1
                  }}
                >
                  {msg.sender === 'user' ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
                </Avatar>
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: 1.5, 
                    bgcolor: msg.sender === 'user' ? 'primary.light' : 'grey.100',
                    borderRadius: 2,
                    color: msg.sender === 'user' ? 'white' : 'text.primary'
                  }}
                >
                  <Typography variant="body1">
                    {msg.content}
                  </Typography>
                </Paper>
              </Box>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ 
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  mt: 0.5,
                  ml: msg.sender === 'user' ? 0 : 5,
                  mr: msg.sender === 'user' ? 5 : 0
                }}
              >
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </ListItem>
          ))}
          {isLoading && (
            <ListItem 
              sx={{ 
                flexDirection: 'column', 
                alignItems: 'flex-start',
                px: 1,
                py: 0.5
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', ml: 5 }}>
                <CircularProgress size={20} thickness={4} />
                <Typography variant="body2" sx={{ ml: 1, color: 'text.secondary' }}>
                  Thinking...
                </Typography>
              </Box>
            </ListItem>
          )}
          <div ref={messagesEndRef} />
        </List>
      </Box>
      
      <Divider />
      
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Type your message here..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
          size="small"
        />
        <IconButton 
          color="primary" 
          onClick={handleSendMessage} 
          disabled={isLoading || newMessage.trim() === ''}
          sx={{ ml: 1 }}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Paper>
  );
};

export default ChatInterface; 