import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  TextField, 
  IconButton, 
  Typography, 
  List, 
  ListItem, 
  ListItemText,
  CircularProgress,
  Divider,
  Avatar
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      const updatedAttributes = updateAttributeBasedOnChat(newMessage, attributes);
      
      // If attributes changed, update them
      if (JSON.stringify(updatedAttributes) !== JSON.stringify(attributes)) {
        onAttributesUpdate(updatedAttributes);
      }

      // Get response from LLM
      const response = await sendMessageToLLM(newMessage, updatedAttributes);
      
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