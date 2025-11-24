# ---- Builder Stage ----
# This stage installs dependencies into a virtual environment using uv.
FROM python:3.11-slim as builder

# Install uv
RUN pip install uv

# Create a virtual environment
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Copy only the dependency file and install dependencies
WORKDIR /app
COPY requirements.txt .
# Install dependencies using uv
RUN uv pip install --no-cache-dir -r requirements.txt

# ---- Final Stage ----
# This stage creates the final, smaller image.
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy the virtual environment with dependencies from the builder stage
COPY --from=builder /opt/venv /opt/venv

# Copy the application code
COPY . .

# Set the path to use the virtual environment's Python and packages
ENV PATH="/opt/venv/bin:$PATH"

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application
# Use --host 0.0.0.0 to make it accessible from outside the container
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
