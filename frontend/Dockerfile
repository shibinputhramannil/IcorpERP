FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests for layer caching
COPY package.json ./

# Install npm dependencies
RUN npm install

# Copy application source code
COPY . .

EXPOSE 3000

# Backend proxy target inside Docker Compose network
ENV VITE_BACKEND_URL=http://backend:8000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
