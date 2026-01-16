FROM public.ecr.aws/lambda/nodejs:20

# Copy package files
COPY package.json ./
COPY package-lock.json* ./

# Install production dependencies only
RUN npm install --omit=dev --no-audit --no-fund

# Copy built application
COPY dist/ ./dist/

# Set handler
CMD [ "dist/handler.handler" ]

