# Any container host: Fly.io, Railway, Koyeb, Google Cloud Run, a VPS.
#   docker build -t homework-todo . && docker run -p 8080:8080 homework-todo
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_BASE=/
ARG VITE_ARCADE_MANIFEST=
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=
ENV VITE_BASE=$VITE_BASE VITE_ARCADE_MANIFEST=$VITE_ARCADE_MANIFEST VITE_SUPABASE_URL=$VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
