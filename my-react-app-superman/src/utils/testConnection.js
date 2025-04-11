export const testBackendConnection = async () => {
  try {
    console.log('Testing connection to:', process.env.REACT_APP_API_URL);
    const response = await fetch(`${process.env.REACT_APP_API_URL}/health`);
    if (response.ok) {
      const data = await response.json();
      console.log('Backend connection successful:', data);
      return true;
    } else {
      console.error('Backend connection failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Error testing backend connection:', error);
    return false;
  }
}; 