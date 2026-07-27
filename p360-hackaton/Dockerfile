FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

EXPOSE ${VITE_PORT}

CMD [ "npm", "run", "dev", "--", "--host" ]
