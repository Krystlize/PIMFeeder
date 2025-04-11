export const testBackendConnection = async () => {
  try {
    console.log('Testing connection to:', process.env.REACT_APP_API_URL);
    // First try the /api/health endpoint
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'omit'  // Don't send credentials
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Backend connection successful via /api/health:', data);
        return true;
      }
    } catch (e) {
      console.warn('Failed to connect via /api/health, trying fallback endpoint');
    }
    
    // If that fails, try the root health endpoint
    const rootResponse = await fetch(`${process.env.REACT_APP_API_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      credentials: 'omit'  // Don't send credentials
    });
    
    if (rootResponse.ok) {
      const data = await rootResponse.json();
      console.log('Backend connection successful via /health:', data);
      return true;
    } else {
      console.error('Backend connection failed:', rootResponse.status);
      return false;
    }
  } catch (error) {
    console.error('Error testing backend connection:', error);
    return false;
  }
}; 