FROM node:20-alpine
WORKDIR /app
RUN npm install express@^4.19.2 prom-client@^15.1.3
COPY server.js ./
EXPOSE 3000
CMD ["node", "server.js"]