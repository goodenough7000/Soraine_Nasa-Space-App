FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node dist ./dist
COPY --chown=node:node server ./server
USER node
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/index.mjs"]
