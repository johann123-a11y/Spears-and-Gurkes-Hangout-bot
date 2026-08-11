FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN chown -R node:node /app
USER node
CMD ["node", "index.js"]
