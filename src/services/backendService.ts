export const getCategoryTemplates = async (category: string, pdfText?: string): Promise<any> => {
  try {
    const response = await axiosInstance.post('/api/generate-template', { 
      category,
      pdfText,
      showDebug: true
    });
    return response.data;
  } catch (error) {
    console.error('Error getting category templates:', error);
    throw error;
  }
}; 