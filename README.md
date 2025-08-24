# LaneMC - Google Ads Automation Platform

## Overview

LaneMC is an AI-powered Google Ads automation platform designed for agencies to streamline campaign management, optimization, and reporting. The application provides an end-to-end workflow from goal capture through AI chat to campaign execution and performance monitoring. Built as a modern web application, it features a React frontend with a Node.js/Express backend, integrated with Google Ads API and OpenRouter for AI capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript running on Vite for development and build tooling
- **UI Library**: Shadcn/UI components built on Radix UI primitives with Tailwind CSS for styling
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for client-side routing
- **Authentication**: JWT token-based authentication with local storage persistence

### Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Language**: TypeScript with ES modules
- **Authentication**: JWT-based auth with bcrypt for password hashing
- **API Design**: RESTful endpoints with middleware for logging, auth, and error handling
- **Development**: Vite integration for hot module replacement in development mode

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL (via DATABASE_URL environment variable)
- **Schema**: Comprehensive data model including users, Google Ads accounts, campaigns, chat sessions, performance metrics, and budget pacing tables
- **Migrations**: Drizzle Kit for schema management and database migrations

### AI Integration
- **Provider**: OpenRouter API for accessing various AI models
- **Default Model**: Anthropic Claude 3 Sonnet
- **Features**: Streaming chat responses with real-time UI updates
- **Context**: Specialized Google Ads automation assistant with domain expertise

### Google Ads Integration
- **API Version**: Google Ads API v15+
- **Authentication**: OAuth2 with refresh token persistence
- **Features**: Account management, campaign CRUD operations, performance metrics retrieval
- **Development Mode**: Mock mode enabled by default to prevent accidental API calls during development

### Security & Authentication
- **Session Management**: JWT tokens with 7-day expiration
- **Password Security**: bcrypt hashing with salt rounds
- **Environment Variables**: All sensitive data stored in environment variables
- **API Protection**: Middleware-based authentication for protected routes

### Data Model Design
- **Users**: Role-based access (user/admin) with secure authentication
- **Google Ads Accounts**: Customer ID mapping with refresh token storage
- **Campaigns**: Complete campaign structure with JSON fields for complex data
- **Chat System**: Session-based conversations with message history
- **Performance Tracking**: Metrics storage with budget pacing calculations
- **Campaign Briefs**: Structured brief management with approval workflows

## External Dependencies

### Core Services
- **Google Ads API**: Campaign management, account access, and performance data retrieval via OAuth2 authentication
- **OpenRouter API**: AI model access for chat-based assistance and automation recommendations
- **PostgreSQL Database**: Primary data storage via Render or similar cloud database provider

### Development Tools
- **Neon Database**: Serverless PostgreSQL for development and production environments
- **Replit Integration**: Custom development tooling and runtime error handling

### Authentication & Security
- **Google OAuth2**: Secure Google Ads account access with refresh token management
- **JWT Tokens**: Stateless authentication with configurable secret keys

### UI and Frontend Libraries
- **Radix UI**: Accessible component primitives for complex UI interactions
- **Tailwind CSS**: Utility-first styling with custom design system
- **Lucide Icons**: Consistent iconography throughout the application

### Build and Development
- **Vite**: Fast development server with hot module replacement and optimized production builds
- **TypeScript**: Type safety across frontend and backend codebases
- **ESBuild**: Fast bundling for production server builds