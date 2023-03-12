FROM alpine
RUN apk add nodejs npm
COPY ./ ./
RUN npm install --omit=dev --force

EXPOSE 8080
CMD ["node", "index.js"]

