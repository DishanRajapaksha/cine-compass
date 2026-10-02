FROM node:24-bookworm-slim AS frontend
WORKDIR /src/front-end
COPY front-end/package*.json ./
RUN npm ci
COPY front-end/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:11.0.100-rc.1 AS backend
WORKDIR /src
COPY global.json ./
COPY back-end/CineCompass.Api/CineCompass.Api.csproj back-end/CineCompass.Api/
RUN dotnet restore back-end/CineCompass.Api
COPY back-end/CineCompass.Api/ back-end/CineCompass.Api/
RUN dotnet publish back-end/CineCompass.Api -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:11.0.0-rc.1
WORKDIR /app
COPY --from=backend /app ./
COPY --from=frontend /src/front-end/build ./wwwroot
RUN mkdir -p /data/keys && chown -R app:app /data
USER app
ENV ASPNETCORE_HTTP_PORTS=8080 DataProtection__Path=/data/keys
EXPOSE 8080
ENTRYPOINT ["dotnet", "CineCompass.Api.dll"]
