FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY tsconfig.json ./
COPY src ./src
COPY db ./db
RUN npm install typescript && npm run build
RUN mkdir -p /app/uploads
RUN mkdir -p /models
EXPOSE 4000
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
