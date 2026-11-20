FROM python:3.12-alpine
WORKDIR /app
COPY server.py /app/server.py
ENV ATLAS_PROJECTS_DB=/data/projects.sqlite3
ENV ATLAS_PROJECTS_HOST=0.0.0.0
ENV ATLAS_PROJECTS_PORT=8130
RUN mkdir -p /data && chown -R nobody:nobody /data /app
VOLUME ["/data"]
EXPOSE 8130
USER nobody
CMD ["python", "-u", "/app/server.py"]
