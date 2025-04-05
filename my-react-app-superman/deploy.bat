@echo off
setlocal enabledelayedexpansion

echo Building the React application...
call npm run build

if %ERRORLEVEL% neq 0 (
  echo Build failed! Exiting...
  exit /b 1
)

echo Build completed successfully!

echo Deployment options:
echo 1. Deploy to GitHub Pages
echo 2. Deploy to Netlify
echo 3. Deploy to Vercel
echo 4. Create a Docker image
echo 5. Exit

set /p option="Select a deployment option (1-5): "

if "%option%"=="1" (
  echo Deploying to GitHub Pages...
  
  :: Install GitHub Pages dependency if not already installed
  call npm install --save-dev gh-pages
  
  :: Check if homepage exists in package.json
  findstr "homepage" package.json > nul
  if %ERRORLEVEL% neq 0 (
    echo Adding GitHub Pages configuration to package.json...
    
    :: Get the repository URL
    for /f "tokens=*" %%a in ('git config --get remote.origin.url') do set REPO_URL=%%a
    
    :: Extract username and repo name (this is a simplified approach)
    for /f "tokens=4,5 delims=/:." %%a in ("!REPO_URL!") do (
      set USERNAME=%%a
      set REPO_NAME=%%b
    )
    
    :: Create a temporary file with updated package.json
    powershell -Command "(Get-Content package.json) -replace '\"name\": \"my-react-app-superman\"', '\"name\": \"my-react-app-superman\",\n  \"homepage\": \"https://!USERNAME!.github.io/!REPO_NAME!\"' | Set-Content package.json.tmp"
    powershell -Command "(Get-Content package.json.tmp) -replace '\"eject\": \"react-scripts eject\"', '\"eject\": \"react-scripts eject\",\n    \"predeploy\": \"npm run build\",\n    \"deploy\": \"gh-pages -d build\"' | Set-Content package.json"
    del package.json.tmp
  )
  
  :: Deploy to GitHub Pages
  call npm run deploy
  echo Deployed to GitHub Pages!
  
) else if "%option%"=="2" (
  echo Deploying to Netlify...
  
  :: Check if Netlify CLI is installed
  where netlify >nul 2>&1
  if %ERRORLEVEL% neq 0 (
    echo Netlify CLI not found. Installing...
    call npm install -g netlify-cli
  )
  
  :: Deploy to Netlify
  call netlify deploy --prod
  echo Deployed to Netlify!
  
) else if "%option%"=="3" (
  echo Deploying to Vercel...
  
  :: Check if Vercel CLI is installed
  where vercel >nul 2>&1
  if %ERRORLEVEL% neq 0 (
    echo Vercel CLI not found. Installing...
    call npm install -g vercel
  )
  
  :: Deploy to Vercel
  call vercel --prod
  echo Deployed to Vercel!
  
) else if "%option%"=="4" (
  echo Creating Docker image...
  
  :: Check if Docker is installed
  where docker >nul 2>&1
  if %ERRORLEVEL% neq 0 (
    echo Docker not found. Please install Docker and try again.
    exit /b 1
  )
  
  :: Create Dockerfile if it doesn't exist
  if not exist Dockerfile (
    echo Creating Dockerfile...
    (
      echo FROM node:14-alpine as build
      echo WORKDIR /app
      echo COPY package.json package-lock.json ./
      echo RUN npm ci
      echo COPY . ./
      echo RUN npm run build
      echo.
      echo FROM nginx:alpine
      echo COPY --from=build /app/build /usr/share/nginx/html
      echo EXPOSE 80
      echo CMD ["nginx", "-g", "daemon off;"]
    ) > Dockerfile
  )
  
  :: Build Docker image
  docker build -t pimfeeder:latest .
  
  echo Docker image created successfully!
  echo To run the Docker container locally, use:
  echo docker run -p 8080:80 pimfeeder:latest
  echo Then access the application at http://localhost:8080
  
) else if "%option%"=="5" (
  echo Exiting...
  exit /b 0
  
) else (
  echo Invalid option. Exiting...
  exit /b 1
)

echo Deployment completed!
endlocal 