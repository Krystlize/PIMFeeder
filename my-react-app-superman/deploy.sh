#!/bin/bash

# Build the React application
echo "Building the React application..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
  echo "Build failed! Exiting..."
  exit 1
fi

echo "Build completed successfully!"

# Deployment options
echo "Deployment options:"
echo "1. Deploy to GitHub Pages"
echo "2. Deploy to Netlify"
echo "3. Deploy to Vercel"
echo "4. Create a Docker image"
echo "5. Exit"

read -p "Select a deployment option (1-5): " option

case $option in
  1)
    echo "Deploying to GitHub Pages..."
    # Install GitHub Pages dependency if not already installed
    npm install --save-dev gh-pages
    
    # Add GitHub Pages scripts to package.json if not already present
    if ! grep -q "\"homepage\":" package.json; then
      # Extract repository URL from git config
      REPO_URL=$(git config --get remote.origin.url)
      USERNAME=$(echo $REPO_URL | sed -n 's/.*github.com[:\/]\([^\/]*\)\/\([^\/]*\).*/\1/p')
      REPO_NAME=$(echo $REPO_URL | sed -n 's/.*github.com[:\/]\([^\/]*\)\/\([^\/]*\).*/\2/p' | sed 's/\.git//')
      
      # Add homepage field to package.json
      sed -i '' "s/\"name\": \"my-react-app-superman\"/\"name\": \"my-react-app-superman\",\n  \"homepage\": \"https:\/\/$USERNAME.github.io\/$REPO_NAME\"/" package.json
      
      # Add deployment scripts to package.json
      sed -i '' "s/\"eject\": \"react-scripts eject\"/\"eject\": \"react-scripts eject\",\n    \"predeploy\": \"npm run build\",\n    \"deploy\": \"gh-pages -d build\"/" package.json
    fi
    
    # Deploy to GitHub Pages
    npm run deploy
    echo "Deployed to GitHub Pages!"
    ;;
    
  2)
    echo "Deploying to Netlify..."
    # Check if Netlify CLI is installed
    if ! command -v netlify &> /dev/null; then
      echo "Netlify CLI not found. Installing..."
      npm install -g netlify-cli
    fi
    
    # Deploy to Netlify
    netlify deploy --prod
    echo "Deployed to Netlify!"
    ;;
    
  3)
    echo "Deploying to Vercel..."
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
      echo "Vercel CLI not found. Installing..."
      npm install -g vercel
    fi
    
    # Deploy to Vercel
    vercel --prod
    echo "Deployed to Vercel!"
    ;;
    
  4)
    echo "Creating Docker image..."
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
      echo "Docker not found. Please install Docker and try again."
      exit 1
    fi
    
    # Create Dockerfile if it doesn't exist
    if [ ! -f Dockerfile ]; then
      cat > Dockerfile << EOF
FROM node:14-alpine as build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF
    fi
    
    # Build Docker image
    docker build -t pimfeeder:latest .
    
    echo "Docker image created successfully!"
    echo "To run the Docker container locally, use:"
    echo "docker run -p 8080:80 pimfeeder:latest"
    echo "Then access the application at http://localhost:8080"
    ;;
    
  5)
    echo "Exiting..."
    exit 0
    ;;
    
  *)
    echo "Invalid option. Exiting..."
    exit 1
    ;;
esac

echo "Deployment completed!" 