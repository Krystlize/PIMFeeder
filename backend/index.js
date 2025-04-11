const app = require('./server');
const port = process.env.PORT || 5000;

// Only listen on port when not in a serverless environment
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

// For Vercel serverless deployment
module.exports = app; 