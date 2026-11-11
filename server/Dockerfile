FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY tsconfig.json ./
COPY src ./src
COPY db ./db
RUN npm install typescript && npm run build
RUN mkdir -p /app/uploads
EXPOSE 4000
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
